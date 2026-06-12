"use server";

import { revalidatePath } from "next/cache";
import { requireOrgAdmin, getOrgId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { createAlias } from "@/lib/stalwart/client";

export async function createAliasAction(formData: FormData) {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session);
  if (!orgId) return;

  const source = (formData.get("source") as string).trim();
  const destination = (formData.get("destination") as string).trim();

  await createAlias(source, destination);

  await prisma.emailAlias.create({
    data: { organizationId: orgId, source, destination },
  });

  revalidatePath("/dashboard/aliases");
}
