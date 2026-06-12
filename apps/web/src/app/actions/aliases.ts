"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgAdmin, resolveOrgId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { createAlias, isStalwartFailure } from "@/lib/stalwart/client";

export async function createAliasAction(formData: FormData) {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const localPart = (formData.get("localPart") as string).trim().toLowerCase();
  const domainId = formData.get("domainId") as string;
  const destination = (formData.get("destination") as string).trim().toLowerCase();

  if (!localPart || !destination) return;

  const domain = await prisma.domain.findFirst({
    where: { id: domainId, organizationId: orgId, status: { in: ["VERIFIED", "ACTIVE"] } },
  });
  if (!domain) return;

  const source = `${localPart}@${domain.fqdn}`;

  const existing = await prisma.emailAlias.findUnique({
    where: { organizationId_source: { organizationId: orgId, source } },
  });
  if (existing) redirect("/dashboard/aliases?error=exists");

  const stalwartRes = await createAlias(source, destination);
  if (isStalwartFailure(stalwartRes)) {
    redirect("/dashboard/aliases?error=stalwart");
  }

  await prisma.emailAlias.create({
    data: { organizationId: orgId, source, destination },
  });

  revalidatePath("/dashboard/aliases");
  redirect(`/dashboard/aliases?created=${encodeURIComponent(source)}`);
}
