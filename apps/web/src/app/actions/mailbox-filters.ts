"use server";

import { revalidatePath } from "next/cache";
import { getOrgId, requireOrgAdmin } from "@/lib/auth-utils";
import {
  getMailboxWebmailTokens,
} from "@/lib/mail/mailbox-access";
import { syncMailboxSieveFilters } from "@/lib/mail/sieve-sync";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/action-result";
import type { MailboxFilterAction } from "@prisma/client";

function parseAction(raw: string): MailboxFilterAction | null {
  const allowed: MailboxFilterAction[] = [
    "MOVE_TO",
    "MARK_READ",
    "MARK_FLAGGED",
    "DELETE",
    "STOP",
  ];
  return allowed.includes(raw as MailboxFilterAction) ? (raw as MailboxFilterAction) : null;
}

async function pushSieveForMailbox(mailboxId: string, organizationId: string) {
  const mailbox = await prisma.mailbox.findFirst({
    where: { id: mailboxId, organizationId },
    select: { address: true, credentialsEnc: true },
  });
  if (!mailbox?.credentialsEnc) {
    return { ok: false as const, message: "stalwartUnavailable" };
  }
  const filters = await prisma.mailboxFilter.findMany({
    where: { mailboxId, organizationId, isEnabled: true },
    orderBy: { sortOrder: "asc" },
  });

  const tokenResult = await getMailboxWebmailTokens(
    mailboxId,
    mailbox.credentialsEnc,
    mailbox.address
  );
  if ("error" in tokenResult) {
    return { ok: false as const, message: "stalwartUnavailable" };
  }

  const synced = await syncMailboxSieveFilters(tokenResult.tokens, filters);
  if ("error" in synced) {
    return { ok: false as const, message: "sieveSyncFailed" };
  }

  return { ok: true as const };
}

export async function createMailboxFilterAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session)!;

  const mailboxId = String(formData.get("mailboxId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const fromAddress = String(formData.get("fromAddress") ?? "").trim() || null;
  const subjectContains = String(formData.get("subjectContains") ?? "").trim() || null;
  const action = parseAction(String(formData.get("action") ?? ""));
  const targetFolder = String(formData.get("targetFolder") ?? "").trim() || null;

  if (!mailboxId || !name || !action) {
    return { ok: false, message: "invalid" };
  }
  if (!fromAddress && !subjectContains) {
    return { ok: false, message: "filterConditionRequired" };
  }
  if (action === "MOVE_TO" && !targetFolder) {
    return { ok: false, message: "filterFolderRequired" };
  }

  const mailbox = await prisma.mailbox.findFirst({
    where: { id: mailboxId, organizationId: orgId },
  });
  if (!mailbox) return { ok: false, message: "notfound" };

  const maxOrder = await prisma.mailboxFilter.aggregate({
    where: { mailboxId },
    _max: { sortOrder: true },
  });

  await prisma.mailboxFilter.create({
    data: {
      organizationId: orgId,
      mailboxId,
      name,
      fromAddress,
      subjectContains,
      action,
      targetFolder,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  const push = await pushSieveForMailbox(mailboxId, orgId);
  if (!push.ok) return { ok: false, message: push.message };

  revalidatePath(`/dashboard/mail/${mailboxId}/filters`);
  return { ok: true, message: "filterCreated", detail: name };
}

export async function deleteMailboxFilterAction(formData: FormData): Promise<void> {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session)!;

  const filterId = String(formData.get("filterId") ?? "").trim();
  if (!filterId) return;

  const filter = await prisma.mailboxFilter.findFirst({
    where: { id: filterId, organizationId: orgId },
  });
  if (!filter) return;

  await prisma.mailboxFilter.delete({ where: { id: filterId } });
  await pushSieveForMailbox(filter.mailboxId, orgId);
  revalidatePath(`/dashboard/mail/${filter.mailboxId}/filters`);
}

export async function toggleMailboxFilterAction(formData: FormData): Promise<void> {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session)!;

  const filterId = String(formData.get("filterId") ?? "").trim();
  if (!filterId) return;

  const filter = await prisma.mailboxFilter.findFirst({
    where: { id: filterId, organizationId: orgId },
  });
  if (!filter) return;

  await prisma.mailboxFilter.update({
    where: { id: filterId },
    data: { isEnabled: !filter.isEnabled },
  });

  await pushSieveForMailbox(filter.mailboxId, orgId);
  revalidatePath(`/dashboard/mail/${filter.mailboxId}/filters`);
}
