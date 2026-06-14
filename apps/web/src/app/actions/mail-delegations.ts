"use server";

import { revalidatePath } from "next/cache";
import { getOrgId, requireOrgAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/action-result";
import type { MailboxDelegationPermission } from "@prisma/client";

function parsePermission(raw: string): MailboxDelegationPermission {
  return raw === "READ" ? "READ" : "SEND";
}

export async function addMailboxDelegationAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session)!;

  const mailboxId = String(formData.get("mailboxId") ?? "").trim();
  const delegateUserId = String(formData.get("delegateUserId") ?? "").trim();
  const permission = parsePermission(String(formData.get("permission") ?? "SEND"));

  if (!mailboxId || !delegateUserId) {
    return { ok: false, message: "invalid" };
  }

  const mailbox = await prisma.mailbox.findFirst({
    where: { id: mailboxId, organizationId: orgId, isShared: false },
    include: { userLinks: { select: { userId: true } } },
  });
  if (!mailbox) return { ok: false, message: "notfound" };

  const ownerUserId = mailbox.userLinks[0]?.userId;
  if (ownerUserId === delegateUserId) {
    return { ok: false, message: "cannotDelegateSelf" };
  }

  const member = await prisma.organizationMember.findFirst({
    where: { organizationId: orgId, userId: delegateUserId },
  });
  if (!member) return { ok: false, message: "invalidDelegate" };

  const existing = await prisma.mailboxDelegation.findUnique({
    where: { mailboxId_delegateUserId: { mailboxId, delegateUserId } },
  });
  if (existing) return { ok: false, message: "exists" };

  await prisma.mailboxDelegation.create({
    data: { organizationId: orgId, mailboxId, delegateUserId, permission },
  });

  revalidatePath("/dashboard/users");
  return { ok: true, message: "delegationAdded", detail: mailbox.address };
}

export async function removeMailboxDelegationAction(formData: FormData): Promise<void> {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session)!;

  const delegationId = String(formData.get("delegationId") ?? "").trim();
  if (!delegationId) return;

  const delegation = await prisma.mailboxDelegation.findFirst({
    where: { id: delegationId, organizationId: orgId },
  });
  if (!delegation) return;

  await prisma.mailboxDelegation.delete({ where: { id: delegationId } });
  revalidatePath("/dashboard/users");
}

export async function updateMailboxDelegationPermissionAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session)!;

  const delegationId = String(formData.get("delegationId") ?? "").trim();
  const permission = parsePermission(String(formData.get("permission") ?? "SEND"));
  if (!delegationId) return { ok: false, message: "invalid" };

  const delegation = await prisma.mailboxDelegation.findFirst({
    where: { id: delegationId, organizationId: orgId },
  });
  if (!delegation) return { ok: false, message: "notfound" };

  await prisma.mailboxDelegation.update({
    where: { id: delegationId },
    data: { permission },
  });

  revalidatePath("/dashboard/users");
  return { ok: true, message: "delegationUpdated" };
}
