import Link from "next/link";
import type { OrganizationStatus } from "@prisma/client";
import { BureauOrgList } from "@/components/bureau/org-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEur, getLatestPricing, syncPricingIfStale } from "@/lib/billing/pricing";
import { loadBureauOrganizations, summarizeBureauOrgs } from "@/lib/bureau/load-orgs";
import { cn } from "@/lib/utils";
import { getT } from "@/i18n/t";

type StatusFilter = OrganizationStatus | "all";

function statusLabel(
  status: OrganizationStatus,
  t: Awaited<ReturnType<typeof getT>>
) {
  if (status === "PENDING") return t("statusPending");
  if (status === "APPROVED") return t("statusApproved");
  return t("statusRejected");
}

export default async function BureauPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const t = await getT("bureau");
  const latestPricing = await getLatestPricing();
  const pricing = latestPricing ?? (await syncPricingIfStale());
  const orgs = await loadBureauOrganizations(pricing);
  const summary = summarizeBureauOrgs(orgs);

  const filter = (params.status ?? "all") as StatusFilter;
  const filtered =
    filter === "all" ? orgs : orgs.filter((org) => org.status === filter);

  const tabs: { key: StatusFilter; label: string; count?: number }[] = [
    { key: "all", label: t("filterAll"), count: summary.total },
    { key: "PENDING", label: t("filterPending"), count: summary.pending },
    { key: "APPROVED", label: t("filterApproved"), count: summary.approved },
    { key: "REJECTED", label: t("filterRejected"), count: summary.rejected },
  ];

  const orgListLabels = {
    colName: t("colName"),
    colStatus: t("colStatus"),
    colAdmin: t("colAdmin"),
    colCreated: t("colCreated"),
    colMailboxes: t("colMailboxes"),
    colDomains: t("colDomains"),
    colStorage: t("colStorage"),
    colCost: t("colCost"),
    colWallet: t("colWallet"),
    colActions: t("colActions"),
    approve: t("approve"),
    reject: t("reject"),
    rejectReason: t("rejectReason"),
    statusLabel: (status: OrganizationStatus) => statusLabel(status, t),
  };

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>
        </div>
        <Button variant="outline" asChild className="min-h-11 w-full sm:w-auto">
          <Link href="/dashboard">{t("myOrg")}</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">{t("statTotal")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{summary.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">{t("statPending")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-amber-700">{summary.pending}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">{t("statApproved")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-emerald-700">{summary.approved}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">{t("statRejected")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-red-700">{summary.rejected}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-500">{t("statMonthlyCost")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatEur(summary.totalMonthlyCost)}</CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "all" ? "/bureau" : `/bureau?status=${tab.key}`}
            className={cn(
              "flex min-h-11 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:min-h-0 sm:justify-start sm:py-1.5",
              filter === tab.key
                ? "bg-zinc-900 text-white"
                : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
            )}
          >
            {tab.label}
            {tab.count != null && (
              <span className={cn("ml-1.5", filter === tab.key ? "text-zinc-300" : "text-zinc-400")}>
                ({tab.count})
              </span>
            )}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("associations")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-hidden">
          {filtered.length === 0 ? (
            <p className="text-sm text-zinc-500">{t("empty")}</p>
          ) : (
            <BureauOrgList orgs={filtered} labels={orgListLabels} />
          )}
        </CardContent>
      </Card>

      {pricing && (
        <p className="text-xs text-zinc-500">
          {t("pricingNote", {
            rate: formatEur(pricing.storageEurPerGbMonth),
            date: pricing.fetchedAt.toLocaleDateString("fr-FR"),
          })}
        </p>
      )}
    </div>
  );
}
