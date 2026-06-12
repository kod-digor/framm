"use server";

import { revalidatePath } from "next/cache";
import { requireOrgAdmin, getOrgId } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { createDomain } from "@/lib/stalwart/client";
import { expectedRecords, verifyDomainDns } from "@/lib/dns/verify";

export async function addDomainAction(formData: FormData) {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session);
  if (!orgId) return;

  const fqdn = (formData.get("fqdn") as string).toLowerCase().trim();
  const mailHost = process.env.PRIMARY_MAIL_HOST ?? "kod-digor.bzh";

  const stalwartRes = await createDomain(fqdn);
  const stalwartDomainId =
    typeof stalwartRes === "object" && stalwartRes !== null && "methodResponses" in stalwartRes
      ? "pending"
      : null;

  await prisma.domain.create({
    data: {
      organizationId: orgId,
      fqdn,
      stalwartDomainId,
      dnsRecordsJson: expectedRecords(fqdn, mailHost),
    },
  });

  revalidatePath("/dashboard/domains");
}

export async function verifyDomainAction(domainId: string) {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session);
  if (!orgId) return;

  const domain = await prisma.domain.findFirst({
    where: { id: domainId, organizationId: orgId },
  });
  if (!domain) return;

  const mailHost = process.env.PRIMARY_MAIL_HOST ?? "kod-digor.bzh";
  const check = await verifyDomainDns(domain.fqdn, mailHost);

  await prisma.domain.update({
    where: { id: domainId },
    data: { status: check.verified ? "VERIFIED" : "PENDING_DNS" },
  });

  revalidatePath("/dashboard/domains");
}
