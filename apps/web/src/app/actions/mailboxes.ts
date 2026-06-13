"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgAdmin, resolveOrgId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/action-result";
import {
  createAccount,
  deleteAccount,
  extractStalwartCreatedId,
  extractStalwartOrphanAccountId,
  extractStalwartSetIssue,
  isStalwartAliasConflict,
  isStalwartFailure,
  resolveStalwartAccountId,
  resolveStalwartDomainId,
  updateAccount,
  updateAccountPassword,
} from "@/lib/stalwart/client";
import { sealSecret } from "@/lib/crypto/seal";

export async function createMailboxAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const localPart = (formData.get("localPart") as string).trim().toLowerCase();
  const domainId = formData.get("domainId") as string;
  const password = (formData.get("password") as string) ?? "";
  const displayNameRaw = (formData.get("displayName") as string)?.trim();
  const displayName = displayNameRaw || null;

  if (!localPart || password.length < 8) {
    return { ok: false, message: "passwordError" };
  }

  const domain = await prisma.domain.findFirst({
    where: { id: domainId, organizationId: orgId, status: { in: ["VERIFIED", "ACTIVE"] } },
  });
  if (!domain) return null;

  const address = `${localPart}@${domain.fqdn}`;

  const existing = await prisma.mailbox.findUnique({ where: { address } });
  if (existing) return { ok: false, message: "exists" };

  const alias = await prisma.emailAlias.findFirst({
    where: { organizationId: orgId, source: address },
  });
  if (alias) return { ok: false, message: "existsAsAlias" };

  const domainResolved = await resolveStalwartDomainId(
    domain.fqdn,
    domain.stalwartDomainId
  );
  if (domainResolved.unavailable) {
    return { ok: false, message: "stalwartUnavailable" };
  }
  if (!domainResolved.id) {
    return { ok: false, message: "stalwartError" };
  }

  const persistDomainId = !domain.stalwartDomainId
    ? prisma.domain.update({
        where: { id: domain.id },
        data: { stalwartDomainId: domainResolved.id },
      })
    : null;

  const stalwartRes = await createAccount(
    localPart,
    domainResolved.id,
    password,
    displayName
  );
  if (isStalwartFailure(stalwartRes)) {
    const issue = extractStalwartSetIssue(stalwartRes);

    if (issue?.type === "unavailable") {
      return { ok: false, message: "stalwartUnavailable" };
    }

    if (isStalwartAliasConflict(issue)) {
      return { ok: false, message: "existsAsAlias" };
    }

    const orphanId = extractStalwartOrphanAccountId(issue);

    if (orphanId) {
      const pwdRes = await updateAccountPassword(orphanId, password);
      if (isStalwartFailure(pwdRes)) {
        console.error("[createMailbox] orphan password update failed:", orphanId, pwdRes);
        return { ok: false, message: "stalwartError" };
      }
      if (displayName) {
        const nameRes = await updateAccount(orphanId, { name: displayName });
        if (isStalwartFailure(nameRes)) {
          console.error("[createMailbox] orphan display name update failed:", orphanId, nameRes);
          return { ok: false, message: "stalwartError" };
        }
      }
      await persistDomainId;
      await prisma.mailbox.create({
        data: {
          organizationId: orgId,
          domainId: domain.id,
          address,
          displayName,
          stalwartAccountId: orphanId,
          credentialsEnc: sealSecret(password),
        },
      });
      revalidatePath("/dashboard/mailboxes");
      return { ok: true, message: "created", detail: address };
    }

    if (issue?.type === "primaryKeyViolation") {
      return { ok: false, message: "exists" };
    }

    console.error(
      "[createMailbox] Stalwart create failed:",
      issue?.objectId?.object ?? "unknown",
      issue ?? stalwartRes
    );
    return { ok: false, message: "stalwartError" };
  }

  const stalwartAccountId = extractStalwartCreatedId(stalwartRes);

  await persistDomainId;
  await prisma.mailbox.create({
    data: {
      organizationId: orgId,
      domainId: domain.id,
      address,
      displayName,
      stalwartAccountId,
      credentialsEnc: sealSecret(password),
    },
  });

  revalidatePath("/dashboard/mailboxes");
  return { ok: true, message: "created", detail: address };
}

export async function updateMailboxAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const mailboxId = formData.get("mailboxId") as string;
  const displayNameRaw = (formData.get("displayName") as string)?.trim();
  const displayName = displayNameRaw || null;
  const password = (formData.get("password") as string) ?? "";

  if (!mailboxId) return null;

  if (password && password.length < 8) {
    return { ok: false, message: "passwordError" };
  }

  const mailbox = await prisma.mailbox.findFirst({
    where: { id: mailboxId, organizationId: orgId },
  });
  if (!mailbox) return { ok: false, message: "notfound" };

  const nameChanged = (mailbox.displayName ?? "") !== (displayName ?? "");
  const passwordChanged = password.length > 0;

  if (!nameChanged && !passwordChanged) {
    revalidatePath("/dashboard/mailboxes");
    return null;
  }

  const resolved = await resolveStalwartAccountId(mailbox.stalwartAccountId, mailbox.address);
  if (resolved.unavailable) {
    return { ok: false, message: "stalwartError" };
  }

  if (resolved.id && (nameChanged || passwordChanged)) {
    const patch: { name?: string; password?: string } = {};
    if (nameChanged) patch.name = displayName ?? parseEmailLocalPart(mailbox.address);
    if (passwordChanged) patch.password = password;

    const stalwartRes = await updateAccount(resolved.id, patch);
    if (isStalwartFailure(stalwartRes)) {
      return { ok: false, message: "stalwartError" };
    }
  }

  const data: { displayName: string | null; credentialsEnc?: string; stalwartAccountId?: string } =
    { displayName };
  if (passwordChanged) data.credentialsEnc = sealSecret(password);
  if (resolved.id && !mailbox.stalwartAccountId) data.stalwartAccountId = resolved.id;

  await prisma.mailbox.update({ where: { id: mailboxId }, data });

  revalidatePath("/dashboard/mailboxes");
  return { ok: true, message: "updated", detail: mailbox.address };
}

export async function deleteMailboxAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const mailboxId = formData.get("mailboxId") as string;
  if (!mailboxId) return null;

  const mailbox = await prisma.mailbox.findFirst({
    where: { id: mailboxId, organizationId: orgId },
  });
  if (!mailbox) return { ok: false, message: "notfound" };

  const resolved = await resolveStalwartAccountId(mailbox.stalwartAccountId, mailbox.address);
  if (resolved.unavailable) {
    return { ok: false, message: "stalwartError" };
  }

  if (resolved.id) {
    const stalwartRes = await deleteAccount(resolved.id);
    if (isStalwartFailure(stalwartRes)) {
      return { ok: false, message: "stalwartError" };
    }
  }

  await prisma.mailbox.delete({ where: { id: mailboxId } });

  revalidatePath("/dashboard/mailboxes");
  return { ok: true, message: "deleted", detail: mailbox.address };
}

function parseEmailLocalPart(email: string): string {
  return email.split("@")[0] ?? email;
}
