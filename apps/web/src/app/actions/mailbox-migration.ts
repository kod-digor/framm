"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { MigrationProvider } from "@prisma/client";
import { requireOrgAdmin, resolveOrgId } from "@/lib/auth-utils";
import type { ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import {
  createMigrationDraft,
  cancelMigration,
  getActiveMigrationForMailbox,
  getActiveMigrationsForOrg,
  queueMigration,
  serializeMigrationStatus,
  storeImapCredentials,
  storeSourceStats,
} from "@/lib/migration/orchestrator";
import { discoverMigrationSource } from "@/lib/migration/discovery";
import { AUTH_UNAVAILABLE_REASONS } from "@/lib/migration/discovery/api-error";
import type { MigrationSourceStats } from "@/lib/migration/discovery/types";
import {
  normalizeImapCredentials,
  validateImapHost,
  validateImapPort,
} from "@/lib/migration/providers/imap-generic";
import type { MigrationStatusPayload } from "@/lib/migration/types";

const PROVIDERS: MigrationProvider[] = [
  "GOOGLE",
  "MICROSOFT",
  "ICLOUD",
  "IMAP_GENERIC",
];

function isProvider(value: string): value is MigrationProvider {
  return PROVIDERS.includes(value as MigrationProvider);
}

async function assertMailboxOrg(mailboxId: string, orgId: string) {
  return prisma.mailbox.findFirst({
    where: { id: mailboxId, organizationId: orgId },
  });
}

export async function startMigrationAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const mailboxId = (formData.get("mailboxId") as string)?.trim();
  const providerRaw = (formData.get("provider") as string)?.trim();

  if (!mailboxId || !providerRaw || !isProvider(providerRaw)) {
    return { ok: false, message: "invalid" };
  }

  const mailbox = await assertMailboxOrg(mailboxId, orgId);
  if (!mailbox) return { ok: false, message: "notfound" };

  const migration = await createMigrationDraft({
    organizationId: orgId,
    mailboxId,
    targetAddress: mailbox.address,
    provider: providerRaw,
  });

  revalidatePath("/dashboard/users");

  return {
    ok: true,
    message: "migrationStarted",
    detail: migration.id,
  };
}

export async function saveImapCredentialsAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const migrationId = (formData.get("migrationId") as string)?.trim();
  const host = (formData.get("host") as string)?.trim();
  const portRaw = Number(formData.get("port"));
  const user = (formData.get("user") as string)?.trim();
  const password = (formData.get("password") as string) ?? "";

  if (!migrationId || !host || !user || password.length < 1) {
    return { ok: false, message: "invalid" };
  }

  if (!validateImapHost(host) || !validateImapPort(portRaw)) {
    return { ok: false, message: "invalidImap" };
  }

  const migration = await prisma.mailboxMigration.findFirst({
    where: { id: migrationId, organizationId: orgId },
  });
  if (!migration) return { ok: false, message: "notfound" };

  const creds = normalizeImapCredentials(host, portRaw, user, password);
  await storeImapCredentials(migrationId, creds, creds.user);

  revalidatePath("/dashboard/users");

  return { ok: true, message: "imapSaved", detail: migrationId };
}

export async function confirmMigrationAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const migrationId = (formData.get("migrationId") as string)?.trim();
  const sourceAddress = (formData.get("sourceAddress") as string)?.trim();
  const scopeMail = formData.get("scopeMail") === "on" || formData.get("scopeMail") === "true";
  const scopeContacts = formData.get("scopeContacts") === "on";
  const scopeCalendar = formData.get("scopeCalendar") === "on";

  if (!migrationId) return { ok: false, message: "invalid" };

  if (!scopeMail && !scopeContacts && !scopeCalendar) {
    return { ok: false, message: "noScopeSelected" };
  }

  const migration = await prisma.mailboxMigration.findFirst({
    where: { id: migrationId, organizationId: orgId },
  });
  if (!migration) return { ok: false, message: "notfound" };

  if (!migration.sourceCredentialsEnc && migration.provider !== "GOOGLE" && migration.provider !== "MICROSOFT") {
    return { ok: false, message: "credentialsMissing" };
  }

  if (migration.provider === "GOOGLE" || migration.provider === "MICROSOFT") {
    if (!migration.sourceCredentialsEnc) {
      return { ok: false, message: "oauthRequired" };
    }
  }

  await queueMigration(
    migrationId,
    { mail: scopeMail, contacts: scopeContacts, calendar: scopeCalendar },
    (sourceAddress || migration.sourceAddress) ?? undefined
  );

  revalidatePath("/dashboard/users");

  return { ok: true, message: "migrationQueued", detail: migrationId };
}

export async function cancelMigrationAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const migrationId = (formData.get("migrationId") as string)?.trim();
  if (!migrationId) return { ok: false, message: "invalid" };

  const migration = await prisma.mailboxMigration.findFirst({
    where: { id: migrationId, organizationId: orgId },
  });
  if (!migration) return { ok: false, message: "notfound" };

  if (migration.status === "COMPLETED" || migration.status === "CANCELLED") {
    return { ok: false, message: "cannotCancel" };
  }

  await cancelMigration(migrationId);
  revalidatePath("/dashboard/users");

  return { ok: true, message: "migrationCancelled", detail: migrationId };
}

export async function listActiveMigrationsAction(): Promise<
  Record<string, MigrationStatusPayload>
> {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) return {};

  const migrations = await getActiveMigrationsForOrg(orgId);
  const map: Record<string, MigrationStatusPayload> = {};
  for (const migration of migrations) {
    map[migration.mailboxId] = serializeMigrationStatus(migration);
  }
  return map;
}

export async function getMigrationStatusAction(
  mailboxId: string
): Promise<MigrationStatusPayload | null> {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) return null;

  const mailbox = await assertMailboxOrg(mailboxId, orgId);
  if (!mailbox) return null;

  const migration = await getActiveMigrationForMailbox(mailboxId);
  if (!migration) return null;

  return serializeMigrationStatus(migration);
}

export async function discoverMigrationSourceAction(
  migrationId: string
): Promise<MigrationSourceStats | null> {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) return null;

  const migration = await prisma.mailboxMigration.findFirst({
    where: { id: migrationId, organizationId: orgId },
  });
  if (!migration) return null;

  const cached = migration.sourceStatsJson as MigrationSourceStats | null;
  if (cached?.discoveredAt) {
    const age = Date.now() - new Date(cached.discoveredAt).getTime();
    const hasAuthFailure = [cached.mail, cached.contacts, cached.calendar].some(
      (section) =>
        !section.available &&
        section.unavailableReason &&
        AUTH_UNAVAILABLE_REASONS.has(section.unavailableReason)
    );
    if (age < 30 * 60 * 1000 && !hasAuthFailure) return cached;
  }

  const stats = await discoverMigrationSource({
    provider: migration.provider,
    sourceCredentialsEnc: migration.sourceCredentialsEnc,
    oauthRefreshTokenEnc: migration.oauthRefreshTokenEnc,
  });

  await storeSourceStats(migrationId, stats);
  revalidatePath("/dashboard/users");

  return stats;
}
