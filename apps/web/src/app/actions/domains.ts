"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgAdmin, resolveOrgId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/action-result";
import {
  createDomain,
  deleteDomain as deleteStalwartDomain,
  isStalwartFailure,
  resolveStalwartDomainId,
} from "@/lib/stalwart/client";
import {
  expectedRecords,
  getPlatformMailHost,
  isPlatformDomain,
} from "@/lib/dns/dns-records";
import { verifyDomainDns } from "@/lib/dns/verify";
import { DomainStatus } from "@prisma/client";

function extractStalwartDomainId(
  res: Awaited<ReturnType<typeof createDomain>>
): string | null {
  if (!res || typeof res !== "object" || !("methodResponses" in res)) return null;
  const created = res.methodResponses?.[0]?.[1] as
    | { created?: Record<string, { id?: string }> }
    | undefined;
  const first = created?.created && Object.values(created.created)[0];
  return first?.id ?? null;
}

export async function addDomainAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const fqdn = (formData.get("fqdn") as string).toLowerCase().trim();
  if (!fqdn) return null;

  const platformHost = getPlatformMailHost();

  const stalwartRes = await createDomain(fqdn);
  const stalwartFailed = isStalwartFailure(stalwartRes);
  const stalwartDomainId = stalwartFailed ? null : extractStalwartDomainId(stalwartRes);
  const dnsRecords = expectedRecords(fqdn, platformHost);
  const dnsCheck = await verifyDomainDns(fqdn, platformHost);
  const status =
    isPlatformDomain(fqdn) || dnsCheck.verified
      ? DomainStatus.VERIFIED
      : DomainStatus.PENDING_DNS;

  await prisma.domain.create({
    data: {
      organizationId: orgId,
      fqdn,
      stalwartDomainId,
      status,
      dnsRecordsJson: dnsRecords,
    },
  });

  revalidatePath("/dashboard/domains");
  if (stalwartFailed) {
    return { ok: false, message: "stalwartSyncFailed", detail: fqdn, warning: true };
  }
  return { ok: true, message: "addSuccess", detail: fqdn };
}

export async function verifyDomainAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const domainId = formData.get("domainId") as string;
  if (!domainId) return null;

  const domain = await prisma.domain.findFirst({
    where: { id: domainId, organizationId: orgId },
  });
  if (!domain) return null;

  const platformHost = getPlatformMailHost();
  const check = await verifyDomainDns(domain.fqdn, platformHost);

  await prisma.domain.update({
    where: { id: domainId },
    data: {
      status: check.verified ? "VERIFIED" : "PENDING_DNS",
      dnsRecordsJson: expectedRecords(domain.fqdn, platformHost),
    },
  });

  revalidatePath("/dashboard/domains", "page");
  if (check.verified) {
    return { ok: true, message: "verifySuccess", detail: domain.fqdn };
  }
  return { ok: false, message: "verifyStillPending", detail: domain.fqdn, warning: true };
}

async function ensureStalwartDomain(
  fqdn: string,
  cachedId: string | null
): Promise<{ id: string | null; unavailable: boolean }> {
  const resolved = await resolveStalwartDomainId(fqdn, cachedId);
  if (resolved.unavailable) return { id: null, unavailable: true };
  if (resolved.id) return { id: resolved.id, unavailable: false };

  const createRes = await createDomain(fqdn);
  if (isStalwartFailure(createRes)) return { id: null, unavailable: true };
  return { id: extractStalwartDomainId(createRes), unavailable: false };
}

export async function forceApproveDomainAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const domainId = formData.get("domainId") as string;
  if (!domainId) return null;

  const domain = await prisma.domain.findFirst({
    where: { id: domainId, organizationId: orgId },
  });
  if (!domain) return null;

  if (isPlatformDomain(domain.fqdn)) return null;

  if (domain.status === "VERIFIED" || domain.status === "ACTIVE") {
    return { ok: true, message: "forceApproveAlreadyVerified", detail: domain.fqdn };
  }

  const platformHost = getPlatformMailHost();
  const stalwart = await ensureStalwartDomain(domain.fqdn, domain.stalwartDomainId);

  await prisma.domain.update({
    where: { id: domainId },
    data: {
      status: DomainStatus.VERIFIED,
      dnsRecordsJson: expectedRecords(domain.fqdn, platformHost),
      ...(stalwart.id && !domain.stalwartDomainId
        ? { stalwartDomainId: stalwart.id }
        : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      organizationId: orgId,
      action: "domain.force_approve",
      target: domain.fqdn,
      metadata: {
        domainId: domain.id,
        previousStatus: domain.status,
        stalwartDomainId: stalwart.id ?? domain.stalwartDomainId,
        stalwartUnavailable: stalwart.unavailable,
      },
    },
  });

  revalidatePath("/dashboard/domains", "page");
  revalidatePath("/dashboard");

  if (stalwart.unavailable) {
    return {
      ok: false,
      message: "forceApproveStalwartFailed",
      detail: domain.fqdn,
      warning: true,
    };
  }

  return { ok: true, message: "forceApproveSuccess", detail: domain.fqdn };
}

export async function deleteDomainAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const domainId = formData.get("domainId") as string;
  if (!domainId) return null;

  const domain = await prisma.domain.findFirst({
    where: { id: domainId, organizationId: orgId },
  });
  if (!domain) return null;

  if (isPlatformDomain(domain.fqdn)) {
    return { ok: false, message: "deletePlatform" };
  }

  const mailboxCount = await prisma.mailbox.count({ where: { domainId } });
  if (mailboxCount > 0) {
    return { ok: false, message: "deleteMailboxes", detail: domain.fqdn };
  }

  if (domain.stalwartDomainId) {
    await deleteStalwartDomain(domain.stalwartDomainId);
  }

  await prisma.domain.delete({ where: { id: domainId } });

  revalidatePath("/dashboard/domains", "page");
  return { ok: true, message: "deleteSuccess", detail: domain.fqdn };
}
