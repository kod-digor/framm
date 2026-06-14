import { unstable_noStore as noStore } from "next/cache";
import { getOrgId, requireOrgAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { AddDomainForm } from "@/components/domains/add-domain-form";
import { DomainsList } from "@/components/domains/domains-list";
import { Card, CardContent } from "@/components/ui/card";
import { getT } from "@/i18n/t";
import { StalwartStatusBanner } from "@/components/stalwart/status-banner";
import {
  expectedRecords,
  getPlatformMailHost,
  isPlatformDomain,
  verifyDomainDns,
} from "@/lib/dns/verify";

export const dynamic = "force-dynamic";

export default async function DomainsPage() {
  noStore();
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session)!;
  const t = await getT("domains");
  const platformHost = getPlatformMailHost();

  const domains = await prisma.domain.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
  });

  const domainCards = await Promise.all(
    domains.map(async (domain) => {
      const isVerified = domain.status === "VERIFIED" || domain.status === "ACTIVE";
      const isPlatform = isPlatformDomain(domain.fqdn);
      const records = expectedRecords(domain.fqdn, platformHost);
      const dnsCheck =
        !isVerified && !isPlatform
          ? await verifyDomainDns(domain.fqdn, platformHost)
          : null;

      return {
        id: domain.id,
        fqdn: domain.fqdn,
        isVerified,
        isPlatform,
        records,
        dnsCheck,
      };
    })
  );

  const tableLabels = {
    colType: t("colType"),
    colHost: t("colHost"),
    colPriority: t("colPriority"),
    colValue: t("colValue"),
    copy: t("copy"),
    copied: t("copied"),
    hostRootHint: t("hostRootHint"),
  };

  const listLabels = {
    statusVerified: t("statusVerified"),
    statusPending: t("statusPending"),
    verified: t("verified"),
    pending: t("pending"),
    records: t("records"),
    recordsIntro: t("recordsIntro", { mailHost: platformHost }),
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <StalwartStatusBanner namespace="domains" />

      <Card>
        <CardContent className="pt-6">
          <AddDomainForm />
        </CardContent>
      </Card>

      {domains.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("empty")}</p>
      ) : (
        <DomainsList
          domains={domainCards}
          labels={listLabels}
          tableLabels={tableLabels}
          mailHost={platformHost}
        />
      )}
    </div>
  );
}
