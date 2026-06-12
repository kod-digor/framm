"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgAdmin, resolveOrgId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { createDomain, deleteDomain as deleteStalwartDomain, isStalwartFailure } from "@/lib/stalwart/client";
import {
  expectedRecords,
  getPlatformMailHost,
  isPlatformDomain,
  verifyDomainDns,
} from "@/lib/dns/verify";
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

export async function addDomainAction(formData: FormData) {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const fqdn = (formData.get("fqdn") as string).toLowerCase().trim();
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
    redirect(
      `/dashboard/domains?stalwart=sync&domain=${encodeURIComponent(fqdn)}`
    );
  }
}

export async function verifyDomainAction(domainId: string) {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const domain = await prisma.domain.findFirst({
    where: { id: domainId, organizationId: orgId },
  });
  if (!domain) return;

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
  redirect(
    check.verified
      ? `/dashboard/domains?verified=1&domain=${encodeURIComponent(domain.fqdn)}`
      : `/dashboard/domains?verified=0&domain=${encodeURIComponent(domain.fqdn)}`
  );
}

export async function deleteDomainAction(domainId: string) {
  const session = await requireOrgAdmin();
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const domain = await prisma.domain.findFirst({
    where: { id: domainId, organizationId: orgId },
  });
  if (!domain) return;

  if (isPlatformDomain(domain.fqdn)) {
    redirect("/dashboard/domains?delete=platform");
  }

  const mailboxCount = await prisma.mailbox.count({ where: { domainId } });
  if (mailboxCount > 0) {
    redirect(
      `/dashboard/domains?delete=mailboxes&domain=${encodeURIComponent(domain.fqdn)}`
    );
  }

  if (domain.stalwartDomainId) {
    await deleteStalwartDomain(domain.stalwartDomainId);
  }

  await prisma.domain.delete({ where: { id: domainId } });

  revalidatePath("/dashboard/domains", "page");
  redirect(
    `/dashboard/domains?deleted=1&domain=${encodeURIComponent(domain.fqdn)}`
  );
}
