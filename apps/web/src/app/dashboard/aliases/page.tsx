import { getOrgId, requireOrgAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { AliasesCrud } from "@/components/aliases/aliases-crud";
import { StalwartStatusBanner } from "@/components/stalwart/status-banner";
import { isDnsVerifiedDomainStatus, MAIL_USABLE_DOMAIN_STATUSES } from "@/lib/domain-status";
import { getT } from "@/i18n/t";

function domainFromSource(source: string) {
  const at = source.indexOf("@");
  return at >= 0 ? source.slice(at + 1) : "—";
}

export default async function AliasesPage() {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session)!;
  const t = await getT("aliases");

  const [aliases, domains] = await Promise.all([
    prisma.emailAlias.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.domain.findMany({
      where: { organizationId: orgId, status: { in: MAIL_USABLE_DOMAIN_STATUSES } },
      orderBy: { fqdn: "asc" },
    }),
  ]);

  const aliasRows = aliases.map((alias) => ({
    id: alias.id,
    source: alias.source,
    destination: alias.destination,
    domain: domainFromSource(alias.source),
  }));

  const listLabels = {
    colSource: t("colSource"),
    colDestination: t("colDestination"),
    colDomain: t("colDomain"),
    colStatus: t("colStatus"),
    colActions: t("colActions"),
    statusActive: t("statusActive"),
  };

  return (
    <div className="space-y-6">
      <StalwartStatusBanner namespace="aliases" />
      <AliasesCrud
        aliases={aliasRows}
        domains={domains.map((d) => ({
          id: d.id,
          fqdn: d.fqdn,
          isDnsVerified: isDnsVerifiedDomainStatus(d.status),
        }))}
        listLabels={listLabels}
      />
    </div>
  );
}
