"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgAdmin, resolveOrgId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/action-result";
import {
  createAccount,
  extractStalwartCreatedId,
  extractStalwartSetIssue,
  isStalwartFailure,
  resolveStalwartDomainId,
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

  const domainResolved = await resolveStalwartDomainId(
    domain.fqdn,
    domain.stalwartDomainId
  );
  if (domainResolved.unavailable || !domainResolved.id) {
    return { ok: false, message: "stalwartError" };
  }

  const persistDomainId = !domain.stalwartDomainId
    ? prisma.domain.update({
        where: { id: domain.id },
        data: { stalwartDomainId: domainResolved.id },
      })
    : null;

  const stalwartRes = await createAccount(localPart, domainResolved.id, password);
  if (isStalwartFailure(stalwartRes)) {
    const issue = extractStalwartSetIssue(stalwartRes);
    const orphanId =
      issue?.type === "primaryKeyViolation" ? issue.objectId?.id : undefined;

    if (orphanId) {
      const pwdRes = await updateAccountPassword(orphanId, password);
      if (isStalwartFailure(pwdRes)) {
        console.error("[createMailbox] orphan password update failed:", orphanId, pwdRes);
        return { ok: false, message: "stalwartError" };
      }
      await persistDomainId;
      await prisma.mailbox.create({
        data: {
          organizationId: orgId,
          domainId: domain.id,
          address,
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

    console.error("[createMailbox] Stalwart create failed:", issue ?? stalwartRes);
    return { ok: false, message: "stalwartError" };
  }

  const stalwartAccountId = extractStalwartCreatedId(stalwartRes);

  await persistDomainId;
  await prisma.mailbox.create({
    data: {
      organizationId: orgId,
      domainId: domain.id,
      address,
      stalwartAccountId,
      credentialsEnc: sealSecret(password),
    },
  });

  revalidatePath("/dashboard/mailboxes");
  return { ok: true, message: "created", detail: address };
}
