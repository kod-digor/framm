"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { requireOrgAdmin, getOrgId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { createAccount } from "@/lib/stalwart/client";

export async function createMailboxAction(formData: FormData) {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session);
  if (!orgId) return;

  const localPart = (formData.get("localPart") as string).trim();
  const domainId = formData.get("domainId") as string;

  const domain = await prisma.domain.findFirst({
    where: { id: domainId, organizationId: orgId, status: { in: ["VERIFIED", "ACTIVE"] } },
  });
  if (!domain) return;

  const address = `${localPart}@${domain.fqdn}`;
  const password = randomBytes(16).toString("base64url");

  await createAccount(address, domain.stalwartDomainId ?? domain.id, password);

  await prisma.mailbox.create({
    data: {
      organizationId: orgId,
      domainId: domain.id,
      address,
      stalwartAccountId: address,
    },
  });

  revalidatePath("/dashboard/mailboxes");
}
