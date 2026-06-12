"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgAdmin, resolveOrgId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { createAccount } from "@/lib/stalwart/client";

export async function createMailboxAction(formData: FormData) {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const localPart = (formData.get("localPart") as string).trim().toLowerCase();
  const domainId = formData.get("domainId") as string;
  const password = (formData.get("password") as string) ?? "";

  if (!localPart || password.length < 8) {
    redirect("/dashboard/mailboxes?error=password");
  }

  const domain = await prisma.domain.findFirst({
    where: { id: domainId, organizationId: orgId, status: { in: ["VERIFIED", "ACTIVE"] } },
  });
  if (!domain) return;

  const address = `${localPart}@${domain.fqdn}`;

  const existing = await prisma.mailbox.findUnique({ where: { address } });
  if (existing) redirect("/dashboard/mailboxes?error=exists");

  const stalwartRes = await createAccount(
    address,
    domain.stalwartDomainId ?? domain.id,
    password
  );
  if (
    stalwartRes &&
    typeof stalwartRes === "object" &&
    ("unavailable" in stalwartRes || "error" in stalwartRes)
  ) {
    redirect("/dashboard/mailboxes?error=stalwart");
  }

  await prisma.mailbox.create({
    data: {
      organizationId: orgId,
      domainId: domain.id,
      address,
      stalwartAccountId: address,
    },
  });

  revalidatePath("/dashboard/mailboxes");
  redirect(`/dashboard/mailboxes?created=${encodeURIComponent(address)}`);
}
