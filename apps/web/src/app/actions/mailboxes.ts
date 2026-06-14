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
  isStalwartDomainIssue,
  isStalwartFailure,
  isStalwartPasswordIssue,
  isStalwartTransportIssue,
  resolveStalwartAccountId,
  resolveStalwartDomainId,
  updateAccount,
  updateAccountPassword,
} from "@/lib/stalwart/client";
import { MAIL_USABLE_DOMAIN_STATUSES } from "@/lib/domain-status";
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
    where: { id: domainId, organizationId: orgId, status: { in: MAIL_USABLE_DOMAIN_STATUSES } },
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
    return { ok: false, message: "domainNotSynced" };
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

    if (isStalwartPasswordIssue(issue)) {
      return { ok: false, message: "passwordWeak" };
    }

    if (isStalwartDomainIssue(issue)) {
      return { ok: false, message: "domainNotSynced" };
    }

    if (isStalwartTransportIssue(issue)) {
      return { ok: false, message: "stalwartUnavailable" };
    }

    const orphanId = extractStalwartOrphanAccountId(issue);

    if (orphanId) {
      const pwdRes = await updateAccountPassword(orphanId, password);
      if (isStalwartFailure(pwdRes)) {
        const pwdIssue = extractStalwartSetIssue(pwdRes);
        console.error("[createMailbox] orphan password update failed:", orphanId, pwdIssue ?? pwdRes);
        if (isStalwartPasswordIssue(pwdIssue)) {
          return { ok: false, message: "passwordWeak" };
        }
        return { ok: false, message: "stalwartError" };
      }
      if (displayName) {
        const descRes = await updateAccount(orphanId, { description: displayName });
        if (isStalwartFailure(descRes)) {
          console.error("[createMailbox] orphan display name update failed:", orphanId, descRes);
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
      issue?.type ?? "unknown",
      issue?.description ?? issue ?? stalwartRes
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
  const quotaUnlimited = formData.get("quotaUnlimited") === "on";
  const quotaGbRaw = (formData.get("quotaGb") as string)?.trim().replace(",", ".");

  if (!mailboxId) return null;

  if (password && password.length < 8) {
    return { ok: false, message: "passwordError" };
  }

  let newQuotaBytes: number | null = null;
  if (!quotaUnlimited) {
    if (!quotaGbRaw) {
      return { ok: false, message: "quotaRequired" };
    }
    const quotaGb = Number.parseFloat(quotaGbRaw);
    if (!Number.isFinite(quotaGb) || quotaGb <= 0) {
      return { ok: false, message: "quotaInvalid" };
    }
    newQuotaBytes = Math.round(quotaGb * 1_073_741_824);
  }

  const mailbox = await prisma.mailbox.findFirst({
    where: { id: mailboxId, organizationId: orgId },
  });
  if (!mailbox) return { ok: false, message: "notfound" };

  const currentQuotaBytes =
    mailbox.quotaBytes !== null && mailbox.quotaBytes !== undefined
      ? Number(mailbox.quotaBytes)
      : null;

  const nameChanged = (mailbox.displayName ?? "") !== (displayName ?? "");
  const passwordChanged = password.length > 0;
  const quotaChanged = currentQuotaBytes !== newQuotaBytes;

  if (!nameChanged && !passwordChanged && !quotaChanged) {
    revalidatePath("/dashboard/mailboxes");
    return null;
  }

  const resolved = await resolveStalwartAccountId(mailbox.stalwartAccountId, mailbox.address);
  if (resolved.unavailable) {
    return { ok: false, message: "stalwartError" };
  }

  if (resolved.id && (nameChanged || quotaChanged)) {
    const stalwartRes = await updateAccount(resolved.id, {
      ...(nameChanged ? { description: displayName } : {}),
      ...(quotaChanged ? { quotaBytes: newQuotaBytes } : {}),
    });
    if (isStalwartFailure(stalwartRes)) {
      const issue = extractStalwartSetIssue(stalwartRes);
      if (isStalwartTransportIssue(issue)) {
        return { ok: false, message: "stalwartUnavailable" };
      }
      return { ok: false, message: "stalwartError" };
    }
  }

  if (passwordChanged) {
    if (!resolved.id) {
      return { ok: false, message: "stalwartError" };
    }
    const pwdRes = await updateAccountPassword(resolved.id, password);
    if (isStalwartFailure(pwdRes)) {
      const issue = extractStalwartSetIssue(pwdRes);
      if (isStalwartPasswordIssue(issue)) {
        return { ok: false, message: "passwordWeak" };
      }
      if (isStalwartTransportIssue(issue)) {
        return { ok: false, message: "stalwartUnavailable" };
      }
      return { ok: false, message: "stalwartError" };
    }
  }

  const data: {
    displayName: string | null;
    credentialsEnc?: string;
    stalwartAccountId?: string;
    quotaBytes?: bigint | null;
  } = { displayName };
  if (passwordChanged) data.credentialsEnc = sealSecret(password);
  if (resolved.id && !mailbox.stalwartAccountId) data.stalwartAccountId = resolved.id;
  if (quotaChanged) data.quotaBytes = newQuotaBytes !== null ? BigInt(newQuotaBytes) : null;

  await prisma.mailbox.update({ where: { id: mailboxId }, data });

  revalidatePath("/dashboard/mailboxes");
  if (passwordChanged) revalidatePath(`/dashboard/mail/${mailboxId}`);
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
