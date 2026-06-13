"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgAdmin, resolveOrgId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/action-result";
import {
  createAlias,
  deleteAlias,
  extractStalwartCreatedId,
  isStalwartFailure,
  resolveEmailAliasStalwartId,
  resolveStalwartDomainId,
  updateAlias,
} from "@/lib/stalwart/client";

export async function createAliasAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const localPart = (formData.get("localPart") as string).trim().toLowerCase();
  const domainId = formData.get("domainId") as string;
  const destination = (formData.get("destination") as string).trim().toLowerCase();

  if (!localPart || !destination) return null;

  const domain = await prisma.domain.findFirst({
    where: { id: domainId, organizationId: orgId, status: { in: ["VERIFIED", "ACTIVE"] } },
  });
  if (!domain) return null;

  const source = `${localPart}@${domain.fqdn}`;

  const existing = await prisma.emailAlias.findUnique({
    where: { organizationId_source: { organizationId: orgId, source } },
  });
  if (existing) return { ok: false, message: "exists" };

  const domainResolved = await resolveStalwartDomainId(
    domain.fqdn,
    domain.stalwartDomainId
  );
  if (domainResolved.unavailable || !domainResolved.id) {
    return { ok: false, message: "stalwartError" };
  }

  const stalwartRes = await createAlias(source, destination, domainResolved.id);
  if (isStalwartFailure(stalwartRes)) {
    return { ok: false, message: "stalwartError" };
  }

  const stalwartAliasId = extractStalwartCreatedId(stalwartRes);

  await prisma.emailAlias.create({
    data: { organizationId: orgId, source, destination, stalwartAliasId },
  });

  revalidatePath("/dashboard/aliases");
  return { ok: true, message: "created", detail: source };
}

export async function updateAliasAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const aliasId = formData.get("aliasId") as string;
  const destination = (formData.get("destination") as string).trim().toLowerCase();

  if (!aliasId || !destination) return null;

  const alias = await prisma.emailAlias.findFirst({
    where: { id: aliasId, organizationId: orgId },
  });
  if (!alias) return { ok: false, message: "notfound" };

  if (alias.destination === destination) {
    revalidatePath("/dashboard/aliases");
    return null;
  }

  const resolved = await resolveEmailAliasStalwartId(alias.stalwartAliasId, alias.source);
  if (resolved.unavailable || !resolved.id) {
    return { ok: false, message: "stalwartError" };
  }

  const stalwartRes = await updateAlias(resolved.id, destination, alias.destination);
  if (isStalwartFailure(stalwartRes)) {
    return { ok: false, message: "stalwartError" };
  }

  await prisma.emailAlias.update({
    where: { id: aliasId },
    data: { destination, stalwartAliasId: resolved.id },
  });

  revalidatePath("/dashboard/aliases");
  return { ok: true, message: "updated", detail: alias.source };
}

export async function deleteAliasAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const aliasId = formData.get("aliasId") as string;
  if (!aliasId) return null;

  const alias = await prisma.emailAlias.findFirst({
    where: { id: aliasId, organizationId: orgId },
  });
  if (!alias) return { ok: false, message: "notfound" };

  const resolved = await resolveEmailAliasStalwartId(alias.stalwartAliasId, alias.source);
  if (resolved.unavailable) {
    return { ok: false, message: "stalwartError" };
  }

  if (resolved.id) {
    const stalwartRes = await deleteAlias(resolved.id);
    if (isStalwartFailure(stalwartRes)) {
      return { ok: false, message: "stalwartError" };
    }
  }

  await prisma.emailAlias.delete({ where: { id: aliasId } });

  revalidatePath("/dashboard/aliases");
  return { ok: true, message: "deleted", detail: alias.source };
}
