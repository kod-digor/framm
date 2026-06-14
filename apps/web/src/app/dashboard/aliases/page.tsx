import { getOrgId, requireOrgAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { AliasList } from "@/components/aliases/alias-list";
import { CreateAliasForm } from "@/components/aliases/create-alias-form";
import { StalwartStatusBanner } from "@/components/stalwart/status-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isDnsVerifiedDomainStatus, MAIL_USABLE_DOMAIN_STATUSES } from "@/lib/domain-status";
import { getT } from "@/i18n/t";
import { ArrowRightLeft } from "lucide-react";

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
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <StalwartStatusBanner namespace="aliases" />

      {domains.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("add")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateAliasForm
              domains={domains.map((d) => ({
                id: d.id,
                fqdn: d.fqdn,
                isDnsVerified: isDnsVerifiedDomainStatus(d.status),
              }))}
            />
          </CardContent>
        </Card>
      ) : (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("noDomain")}
        </p>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("listTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {aliases.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-6 py-10 text-center">
              <ArrowRightLeft className="mx-auto size-8 text-zinc-300" aria-hidden />
              <p className="mt-3 text-sm font-medium text-zinc-700">{t("emptyTitle")}</p>
              <p className="mt-1 text-sm text-zinc-500">{t("emptyHint")}</p>
            </div>
          ) : (
            <AliasList aliases={aliasRows} labels={listLabels} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
