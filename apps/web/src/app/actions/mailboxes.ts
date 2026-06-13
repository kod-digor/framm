"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgAdmin, resolveOrgId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/action-result";
import {
  createAccount,
  extractStalwartCreatedId,
  isStalwartFailure,
  resolveStalwartDomainId,
} from "@/lib/stalwart/client";

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

  const stalwartRes = await createAccount(localPart, domainResolved.id, password);
  if (isStalwartFailure(stalwartRes)) {
    return { ok: false, message: "stalwartError" };
  }

  const stalwartAccountId = extractStalwartCreatedId(stalwartRes);

  await prisma.mailbox.create({
    data: {
      organizationId: orgId,
      domainId: domain.id,
      address,
      stalwartAccountId,
    },
  });

  revalidatePath("/dashboard/mailboxes");
  return { ok: true, message: "created", detail: address };
}
