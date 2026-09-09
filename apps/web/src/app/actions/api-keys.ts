"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgAdmin, resolveOrgId } from "@/lib/auth-utils";
import { createOrganizationApiKey } from "@/lib/api-keys";
import type { ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";

export async function createApiKeyAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { ok: false, message: "nameRequired" };

  const { token } = await createOrganizationApiKey({
    organizationId: orgId,
    name,
    createdById: session.user.id,
  });

  revalidatePath("/dashboard/api-keys");
  return { ok: true, message: "createSuccess", token };
}

export async function revokeApiKeyAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const keyId = formData.get("keyId") as string;
  if (!keyId) return null;

  const key = await prisma.organizationApiKey.findFirst({
    where: { id: keyId, organizationId: orgId, revokedAt: null },
    select: { id: true },
  });
  if (!key) return { ok: false, message: "notFound" };

  await prisma.organizationApiKey.update({
    where: { id: key.id },
    data: { revokedAt: new Date() },
  });

  revalidatePath("/dashboard/api-keys");
  return { ok: true, message: "revokeSuccess" };
}
