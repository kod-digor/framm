"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgAdmin, resolveOrgId } from "@/lib/auth-utils";
import type { ActionResult } from "@/lib/action-result";
import { MAIL_USABLE_DOMAIN_STATUSES } from "@/lib/domain-status";
import { sealSecret } from "@/lib/crypto/seal";
import { generateMailboxPassword } from "@/lib/mail/generate-mailbox-password";
import { prisma } from "@/lib/prisma";
import {
  createAccount,
  deleteAccount,
  extractStalwartCreatedId,
  extractStalwartOrphanAccountId,
  extractStalwartSetIssue,
  isStalwartFailure,
  isStalwartPasswordIssue,
  resolveStalwartAccountId,
  resolveStalwartDomainId,
  updateAccount,
} from "@/lib/stalwart/client";

function parseMemberUserIds(formData: FormData): string[] {
  const fromGetAll = formData.getAll("memberIds").map((v) => String(v).trim()).filter(Boolean);
  if (fromGetAll.length > 0) return [...new Set(fromGetAll)];

  const raw = (formData.get("memberIds") as string) ?? "";
  return [...new Set(raw.split(",").map((id) => id.trim()).filter(Boolean))];
}

async function resolveOrgDomain(orgId: string, domainId: string) {
  const domain = await prisma.domain.findFirst({
    where: { id: domainId, organizationId: orgId, status: { in: MAIL_USABLE_DOMAIN_STATUSES } },
  });
  if (!domain) return null;

  const domainResolved = await resolveStalwartDomainId(domain.fqdn, domain.stalwartDomainId);
  if (domainResolved.unavailable || !domainResolved.id) return null;

  if (!domain.stalwartDomainId) {
    await prisma.domain.update({
      where: { id: domain.id },
      data: { stalwartDomainId: domainResolved.id },
    });
  }

  return { domain, stalwartDomainId: domainResolved.id };
}

async function validateOrgMemberUserIds(orgId: string, userIds: string[]): Promise<boolean> {
  if (userIds.length === 0) return false;
  const count = await prisma.organizationMember.count({
    where: { organizationId: orgId, userId: { in: userIds } },
  });
  return count === userIds.length;
}

export async function createSharedMailboxAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const localPart = (formData.get("localPart") as string).trim().toLowerCase();
  const domainId = formData.get("domainId") as string;
  const displayNameRaw = (formData.get("displayName") as string)?.trim();
  const displayName = displayNameRaw || null;
  const memberUserIds = parseMemberUserIds(formData);

  if (!localPart || memberUserIds.length === 0) {
    return { ok: false, message: "invalid" };
  }

  if (!(await validateOrgMemberUserIds(orgId, memberUserIds))) {
    return { ok: false, message: "invalidMembers" };
  }

  const domainCtx = await resolveOrgDomain(orgId, domainId);
  if (!domainCtx) return { ok: false, message: "domainError" };

  const address = `${localPart}@${domainCtx.domain.fqdn}`;

  const addressTaken =
    (await prisma.mailbox.findUnique({ where: { address } })) ??
    (await prisma.mailboxAddress.findUnique({ where: { address } })) ??
    (await prisma.sharedMailbox.findUnique({ where: { address } }));

  if (addressTaken) return { ok: false, message: "exists" };

  const password = generateMailboxPassword();
  const stalwartRes = await createAccount(
    localPart,
    domainCtx.stalwartDomainId,
    password,
    displayName
  );

  if (isStalwartFailure(stalwartRes)) {
    const issue = extractStalwartSetIssue(stalwartRes);
    if (issue?.type === "unavailable") {
      return { ok: false, message: "stalwartUnavailable" };
    }
    if (isStalwartPasswordIssue(issue)) {
      return { ok: false, message: "stalwartError" };
    }
    const orphanId = extractStalwartOrphanAccountId(issue);
    if (orphanId) {
      if (displayName) {
        const descRes = await updateAccount(orphanId, { description: displayName });
        if (isStalwartFailure(descRes)) {
          return { ok: false, message: "stalwartError" };
        }
      }
      await prisma.$transaction(async (tx) => {
        const mailbox = await tx.mailbox.create({
          data: {
            organizationId: orgId,
            domainId: domainCtx.domain.id,
            address,
            displayName,
            stalwartAccountId: orphanId,
            credentialsEnc: sealSecret(password),
            isShared: true,
          },
        });
        await tx.sharedMailbox.create({
          data: {
            organizationId: orgId,
            address,
            displayName,
            mailboxId: mailbox.id,
            members: {
              create: memberUserIds.map((userId) => ({ userId })),
            },
          },
        });
      });
      revalidatePath("/dashboard/shared-mailboxes");
      revalidatePath("/dashboard");
      return { ok: true, message: "created", detail: address };
    }
    return { ok: false, message: "stalwartError" };
  }

  const stalwartAccountId = extractStalwartCreatedId(stalwartRes);
  if (!stalwartAccountId) return { ok: false, message: "stalwartError" };

  await prisma.$transaction(async (tx) => {
    const mailbox = await tx.mailbox.create({
      data: {
        organizationId: orgId,
        domainId: domainCtx.domain.id,
        address,
        displayName,
        stalwartAccountId,
        credentialsEnc: sealSecret(password),
        isShared: true,
      },
    });
    await tx.sharedMailbox.create({
      data: {
        organizationId: orgId,
        address,
        displayName,
        mailboxId: mailbox.id,
        members: {
          create: memberUserIds.map((userId) => ({ userId })),
        },
      },
    });
  });

  revalidatePath("/dashboard/shared-mailboxes");
  revalidatePath("/dashboard");
  return { ok: true, message: "created", detail: address };
}

export async function updateSharedMailboxAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const sharedMailboxId = formData.get("sharedMailboxId") as string;
  const displayNameRaw = (formData.get("displayName") as string)?.trim();
  const displayName = displayNameRaw || null;
  const memberUserIds = parseMemberUserIds(formData);

  if (!sharedMailboxId || memberUserIds.length === 0) {
    return { ok: false, message: "invalid" };
  }

  const shared = await prisma.sharedMailbox.findFirst({
    where: { id: sharedMailboxId, organizationId: orgId },
    include: { members: true, mailbox: true },
  });
  if (!shared) return { ok: false, message: "notfound" };

  if (!(await validateOrgMemberUserIds(orgId, memberUserIds))) {
    return { ok: false, message: "invalidMembers" };
  }

  const currentIds = new Set(shared.members.map((m) => m.userId));
  const nextIds = new Set(memberUserIds);
  const toAdd = memberUserIds.filter((id) => !currentIds.has(id));
  const toRemove = shared.members.filter((m) => !nextIds.has(m.userId)).map((m) => m.id);

  if (shared.mailbox && displayName !== shared.displayName) {
    const resolved = await resolveStalwartAccountId(
      shared.mailbox.stalwartAccountId,
      shared.mailbox.address
    );
    if (resolved.id) {
      const descRes = await updateAccount(resolved.id, { description: displayName });
      if (isStalwartFailure(descRes)) {
        return { ok: false, message: "stalwartError" };
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.sharedMailbox.update({
      where: { id: shared.id },
      data: { displayName },
    });
    if (shared.mailboxId) {
      await tx.mailbox.update({
        where: { id: shared.mailboxId },
        data: { displayName },
      });
    }
    if (toRemove.length > 0) {
      await tx.sharedMailboxMember.deleteMany({ where: { id: { in: toRemove } } });
    }
    if (toAdd.length > 0) {
      await tx.sharedMailboxMember.createMany({
        data: toAdd.map((userId) => ({ sharedMailboxId: shared.id, userId })),
      });
    }
  });

  revalidatePath("/dashboard/shared-mailboxes");
  revalidatePath("/dashboard");
  return { ok: true, message: "updated", detail: shared.address };
}

export async function deleteSharedMailboxAction(formData: FormData) {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const sharedMailboxId = formData.get("sharedMailboxId") as string;
  const shared = await prisma.sharedMailbox.findFirst({
    where: { id: sharedMailboxId, organizationId: orgId },
    include: { mailbox: true },
  });
  if (!shared?.mailbox) return;

  const resolved = await resolveStalwartAccountId(
    shared.mailbox.stalwartAccountId,
    shared.mailbox.address
  );
  if (resolved.id) {
    const delRes = await deleteAccount(resolved.id);
    if (isStalwartFailure(delRes)) return;
  }

  await prisma.sharedMailbox.delete({ where: { id: shared.id } });
  await prisma.mailbox.delete({ where: { id: shared.mailbox.id } });

  revalidatePath("/dashboard/shared-mailboxes");
  revalidatePath("/dashboard");
}
