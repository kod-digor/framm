import type { MigrationPhase, MigrationProvider, MigrationStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sealSecret } from "@/lib/crypto/seal";
import type {
  ImapSourceCredentials,
  MigrationProgress,
  MigrationScope,
  MigrationStatusPayload,
  OAuthTokens,
} from "@/lib/migration/types";
import { ACTIVE_MIGRATION_STATUSES } from "@/lib/migration/types";

function parseProgressJson(value: unknown): MigrationProgress | null {
  if (!value || typeof value !== "object") return null;
  const p = value as MigrationProgress;
  if (typeof p.percent !== "number") return null;
  return p;
}

export function serializeMigrationStatus(
  migration: {
    id: string;
    mailboxId: string;
    provider: MigrationProvider;
    status: MigrationStatus;
    phase: MigrationPhase | null;
    sourceAddress: string | null;
    targetAddress: string;
    scopeMail: boolean;
    scopeContacts: boolean;
    scopeCalendar: boolean;
    progressJson: unknown;
    errorMessage: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    events: {
      id: string;
      phase: MigrationPhase | null;
      message: string;
      createdAt: Date;
    }[];
  }
): MigrationStatusPayload {
  return {
    id: migration.id,
    mailboxId: migration.mailboxId,
    provider: migration.provider,
    status: migration.status,
    phase: migration.phase,
    sourceAddress: migration.sourceAddress,
    targetAddress: migration.targetAddress,
    scopeMail: migration.scopeMail,
    scopeContacts: migration.scopeContacts,
    scopeCalendar: migration.scopeCalendar,
    progress: parseProgressJson(migration.progressJson),
    errorMessage: migration.errorMessage,
    startedAt: migration.startedAt?.toISOString() ?? null,
    completedAt: migration.completedAt?.toISOString() ?? null,
    events: migration.events.map((e) => ({
      id: e.id,
      phase: e.phase,
      message: e.message,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

export async function getActiveMigrationForMailbox(mailboxId: string) {
  return prisma.mailboxMigration.findFirst({
    where: {
      mailboxId,
      status: { in: ACTIVE_MIGRATION_STATUSES },
    },
    orderBy: { createdAt: "desc" },
    include: {
      events: { orderBy: { createdAt: "asc" }, take: 50 },
    },
  });
}

export async function createMigrationDraft(params: {
  organizationId: string;
  mailboxId: string;
  targetAddress: string;
  provider: MigrationProvider;
  sourceAddress?: string | null;
}) {
  const existing = await getActiveMigrationForMailbox(params.mailboxId);
  if (existing) return existing;

  return prisma.mailboxMigration.create({
    data: {
      organizationId: params.organizationId,
      mailboxId: params.mailboxId,
      provider: params.provider,
      targetAddress: params.targetAddress,
      sourceAddress: params.sourceAddress ?? null,
      status: "PENDING_OAUTH",
    },
  });
}

export async function logMigrationEvent(
  migrationId: string,
  message: string,
  phase?: MigrationPhase,
  metadata?: Record<string, unknown>
) {
  await prisma.migrationEvent.create({
    data: {
      migrationId,
      message,
      phase,
      metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
    },
  });
}

export async function storeImapCredentials(
  migrationId: string,
  credentials: ImapSourceCredentials,
  sourceAddress?: string
) {
  const enc = await sealSecret(JSON.stringify(credentials));
  await prisma.mailboxMigration.update({
    where: { id: migrationId },
    data: {
      sourceCredentialsEnc: enc,
      sourceAddress: sourceAddress ?? credentials.user,
      status: "PENDING_OAUTH",
    },
  });
}

export async function storeOAuthTokens(
  migrationId: string,
  tokens: OAuthTokens,
  imapUser: string,
  oauthProvider: "google" | "microsoft"
) {
  const sourceCreds: ImapSourceCredentials = {
    host:
      oauthProvider === "google" ? "imap.gmail.com" : "outlook.office365.com",
    port: 993,
    user: imapUser,
    oauthAccessToken: tokens.accessToken,
    oauthProvider,
  };

  const sourceEnc = await sealSecret(JSON.stringify(sourceCreds));
  const refreshEnc = tokens.refreshToken
    ? await sealSecret(tokens.refreshToken)
    : null;

  await prisma.mailboxMigration.update({
    where: { id: migrationId },
    data: {
      sourceCredentialsEnc: sourceEnc,
      oauthRefreshTokenEnc: refreshEnc,
      sourceAddress: tokens.email ?? imapUser,
      status: "PENDING_OAUTH",
    },
  });
}

export async function queueMigration(
  migrationId: string,
  scope: MigrationScope,
  sourceAddress?: string
) {
  await prisma.mailboxMigration.update({
    where: { id: migrationId },
    data: {
      scopeMail: scope.mail,
      scopeContacts: scope.contacts,
      scopeCalendar: scope.calendar,
      sourceAddress: sourceAddress ?? undefined,
      status: "QUEUED",
      phase: "CONNECTING",
      progressJson: { percent: 0 },
      errorMessage: null,
    },
  });

  await logMigrationEvent(migrationId, "migration_queued", "CONNECTING");
}

export async function cancelMigration(migrationId: string) {
  await prisma.mailboxMigration.update({
    where: { id: migrationId },
    data: {
      status: "CANCELLED",
      completedAt: new Date(),
    },
  });
  await logMigrationEvent(migrationId, "migration_cancelled");
}

export async function markMigrationRunning(migrationId: string) {
  await prisma.mailboxMigration.update({
    where: { id: migrationId },
    data: {
      status: "RUNNING",
      phase: "SYNCING_MAIL",
      startedAt: new Date(),
    },
  });
  await logMigrationEvent(migrationId, "migration_started", "SYNCING_MAIL");
}

export async function updateMigrationProgress(
  migrationId: string,
  progress: MigrationProgress,
  phase?: MigrationPhase
) {
  await prisma.mailboxMigration.update({
    where: { id: migrationId },
    data: {
      progressJson: progress,
      phase: phase ?? undefined,
    },
  });
}

export async function completeMigration(migrationId: string) {
  await prisma.mailboxMigration.update({
    where: { id: migrationId },
    data: {
      status: "COMPLETED",
      phase: "FINALIZING",
      completedAt: new Date(),
      progressJson: { percent: 100 },
      sourceCredentialsEnc: null,
      oauthRefreshTokenEnc: null,
    },
  });
  await logMigrationEvent(migrationId, "migration_completed", "FINALIZING");
}

export async function failMigration(migrationId: string, error: string) {
  await prisma.mailboxMigration.update({
    where: { id: migrationId },
    data: {
      status: "FAILED",
      errorMessage: error,
      completedAt: new Date(),
      sourceCredentialsEnc: null,
      oauthRefreshTokenEnc: null,
    },
  });
  await logMigrationEvent(migrationId, error);
}

export async function wipeMigrationSecrets(migrationId: string) {
  await prisma.mailboxMigration.update({
    where: { id: migrationId },
    data: {
      sourceCredentialsEnc: null,
      oauthRefreshTokenEnc: null,
    },
  });
}
