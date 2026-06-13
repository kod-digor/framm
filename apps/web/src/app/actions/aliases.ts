"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgAdmin, resolveOrgId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import {
  createAlias,
  deleteAlias,
  extractStalwartCreatedId,
  isStalwartFailure,
  resolveEmailAliasStalwartId,
  updateAlias,
} from "@/lib/stalwart/client";

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

  const stalwartAliasId = extractStalwartCreatedId(stalwartRes);

  await prisma.emailAlias.create({
    data: { organizationId: orgId, source, destination, stalwartAliasId },
  });

  revalidatePath("/dashboard/aliases");
  redirect(`/dashboard/aliases?created=${encodeURIComponent(source)}`);
}

export async function updateAliasAction(formData: FormData) {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const aliasId = formData.get("aliasId") as string;
  const destination = (formData.get("destination") as string).trim().toLowerCase();

  if (!aliasId || !destination) return;

  const alias = await prisma.emailAlias.findFirst({
    where: { id: aliasId, organizationId: orgId },
  });
  if (!alias) redirect("/dashboard/aliases?error=notfound");

  if (alias.destination === destination) {
    revalidatePath("/dashboard/aliases");
    return;
  }

  const resolved = await resolveEmailAliasStalwartId(alias.stalwartAliasId, alias.source);
  if (resolved.unavailable || !resolved.id) {
    redirect("/dashboard/aliases?error=stalwart");
  }

  const stalwartRes = await updateAlias(resolved.id, destination);
  if (isStalwartFailure(stalwartRes)) {
    redirect("/dashboard/aliases?error=stalwart");
  }

  await prisma.emailAlias.update({
    where: { id: aliasId },
    data: { destination, stalwartAliasId: resolved.id },
  });

  revalidatePath("/dashboard/aliases");
  redirect(`/dashboard/aliases?updated=${encodeURIComponent(alias.source)}`);
}

export async function deleteAliasAction(formData: FormData) {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const aliasId = formData.get("aliasId") as string;
  if (!aliasId) return;

  const alias = await prisma.emailAlias.findFirst({
    where: { id: aliasId, organizationId: orgId },
  });
  if (!alias) redirect("/dashboard/aliases?error=notfound");

  const resolved = await resolveEmailAliasStalwartId(alias.stalwartAliasId, alias.source);
  if (resolved.unavailable) {
    redirect("/dashboard/aliases?error=stalwart");
  }

  if (resolved.id) {
    const stalwartRes = await deleteAlias(resolved.id);
    if (isStalwartFailure(stalwartRes)) {
      redirect("/dashboard/aliases?error=stalwart");
    }
  }

  await prisma.emailAlias.delete({ where: { id: aliasId } });

  revalidatePath("/dashboard/aliases");
  redirect(`/dashboard/aliases?deleted=${encodeURIComponent(alias.source)}`);
}
