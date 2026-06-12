import { unstable_noStore as noStore } from "next/cache";
import { getOrgId, requireOrgAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { addDomainAction, deleteDomainAction, verifyDomainAction } from "@/app/actions/domains";
import { DeleteDomainForm } from "@/components/domains/delete-domain-form";
import { DnsRecordsTable } from "@/components/domains/dns-records-table";
import { DnsStatusPanel } from "@/components/domains/dns-status-panel";
import { VerifyDomainForm } from "@/components/domains/verify-domain-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/t";
import { StalwartStatusBanner } from "@/components/stalwart/status-banner";
import {
  expectedRecords,
  getPlatformMailHost,
  isPlatformDomain,
  verifyDomainDns,
} from "@/lib/dns/verify";

export const dynamic = "force-dynamic";

export default async function DomainsPage({
  searchParams,
}: {
  searchParams: Promise<{
    stalwart?: string;
    verified?: string;
    domain?: string;
    deleted?: string;
    delete?: string;
  }>;
}) {
  noStore();
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session)!;
  const t = await getT("domains");
  const params = await searchParams;
  const stalwartSyncFailed =
    params.stalwart === "sync" || params.stalwart === "error";
  const syncDomain = params.domain;
  const verifySuccess = params.verified === "1";
  const verifyPending = params.verified === "0";
  const verifiedDomain = params.domain;
  const deleteSuccess = params.deleted === "1";
  const deletePlatform = params.delete === "platform";
  const deleteMailboxes = params.delete === "mailboxes";
  const platformHost = getPlatformMailHost();

  const domains = await prisma.domain.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
  });

  const tableLabels = {
    colType: t("colType"),
    colHost: t("colHost"),
    colPriority: t("colPriority"),
    colValue: t("colValue"),
    copy: t("copy"),
    copied: t("copied"),
    hostRootHint: t("hostRootHint"),
  };

  const dnsStatusLabels = {
    title: t("dnsCurrentTitle"),
    expected: t("dnsExpected"),
    found: t("dnsFound"),
    nxdomain: t("dnsNxdomain"),
    none: t("dnsNone"),
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <StalwartStatusBanner namespace="domains" />

      {stalwartSyncFailed && syncDomain && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("stalwartSyncFailed", { domain: syncDomain })}
        </p>
      )}

      {stalwartSyncFailed && !syncDomain && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("stalwartError")}
        </p>
      )}

      {verifySuccess && verifiedDomain && (
        <p className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {t("verifySuccess", { domain: verifiedDomain })}
        </p>
      )}

      {verifyPending && verifiedDomain && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("verifyStillPending", { domain: verifiedDomain })}
        </p>
      )}

      {deleteSuccess && verifiedDomain && (
        <p className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {t("deleteSuccess", { domain: verifiedDomain })}
        </p>
      )}

      {deletePlatform && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {t("deletePlatform")}
        </p>
      )}

      {deleteMailboxes && verifiedDomain && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {t("deleteMailboxes", { domain: verifiedDomain })}
        </p>
      )}

      <Card>
        <CardContent className="pt-6">
          <form action={addDomainAction} className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="fqdn">{t("fqdn")}</Label>
              <Input id="fqdn" name="fqdn" placeholder="monasso.bzh" required />
            </div>
            <Button type="submit" className="self-end">
              {t("add")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {domains.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("empty")}</p>
      ) : (
        <div className="space-y-4">
          {await Promise.all(
            domains.map(async (domain) => {
            const isVerified =
              domain.status === "VERIFIED" || domain.status === "ACTIVE";
            const isPlatform = isPlatformDomain(domain.fqdn);
            const records = expectedRecords(domain.fqdn, platformHost);
            const dnsCheck =
              !isVerified && !isPlatform
                ? await verifyDomainDns(domain.fqdn, platformHost)
                : null;

            return (
              <Card key={domain.id}>
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                  <CardTitle className="text-lg">{domain.fqdn}</CardTitle>
                  <span
                    className={
                      isVerified
                        ? "rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800"
                        : "rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800"
                    }
                  >
                    {isVerified ? t("statusVerified") : t("statusPending")}
                  </span>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-zinc-600">
                    {isVerified ? t("verified") : t("pending")}
                  </p>

                  {!isVerified && !isPlatform && records.length > 0 && (
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-sm font-medium text-zinc-900">{t("records")}</h3>
                        <p className="mt-1 text-sm text-zinc-500">
                          {t("recordsIntro", { mailHost: platformHost })}
                        </p>
                      </div>
                      <DnsRecordsTable
                        records={records}
                        fqdn={domain.fqdn}
                        labels={tableLabels}
                      />
                      {dnsCheck && (
                        <DnsStatusPanel check={dnsCheck} labels={dnsStatusLabels} />
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    {!isVerified && !isPlatform && (
                      <VerifyDomainForm action={verifyDomainAction.bind(null, domain.id)} />
                    )}
                    {!isPlatform && (
                      <DeleteDomainForm
                        action={deleteDomainAction.bind(null, domain.id)}
                        fqdn={domain.fqdn}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
          )}
        </div>
      )}
    </div>
  );
}
