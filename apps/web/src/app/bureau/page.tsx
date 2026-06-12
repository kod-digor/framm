import Link from "next/link";
import type { OrganizationStatus } from "@prisma/client";
import { approveOrganization, rejectOrganizationForm } from "@/app/actions/bureau";
import { OrgStatusBadge } from "@/components/bureau/org-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEur, getLatestPricing, syncPricingIfStale } from "@/lib/billing/pricing";
import { loadBureauOrganizations, summarizeBureauOrgs } from "@/lib/bureau/load-orgs";
import { cn, formatBytes } from "@/lib/utils";
import { getT } from "@/i18n/t";

type StatusFilter = OrganizationStatus | "all";

function formatDate(date: Date) {
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard">{t("myOrg")}</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "all" ? "/bureau" : `/bureau?status=${tab.key}`}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
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
        <CardContent className="overflow-x-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-zinc-500">{t("empty")}</p>
          ) : (
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead>
                <tr className="border-b text-zinc-500">
                  <th className="pb-2 pr-4 font-medium">{t("colName")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("colStatus")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("colAdmin")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("colCreated")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("colMailboxes")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("colDomains")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("colStorage")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("colCost")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("colWallet")}</th>
                  <th className="pb-2 font-medium">{t("colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((org) => (
                  <tr key={org.id} className="border-b border-zinc-100 align-top">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-zinc-900">{org.name}</p>
                      <p className="text-xs text-zinc-500">{org.slug}</p>
                      {org.status === "PENDING" && (
                        <p className="mt-1 max-w-xs text-xs text-zinc-500 line-clamp-2">
                          {org.presentation}
                        </p>
                      )}
                      {org.status === "REJECTED" && org.rejectReason && (
                        <p className="mt-1 max-w-xs text-xs text-red-600">{org.rejectReason}</p>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <OrgStatusBadge
                        status={org.status}
                        label={statusLabel(org.status, t)}
                      />
                    </td>
                    <td className="py-3 pr-4 text-zinc-700">{org.adminEmail ?? "—"}</td>
                    <td className="py-3 pr-4 text-zinc-700">{formatDate(org.createdAt)}</td>
                    <td className="py-3 pr-4 text-zinc-700">{org.mailboxCount}</td>
                    <td className="py-3 pr-4 text-zinc-700">{org.domainCount}</td>
                    <td className="py-3 pr-4 font-medium text-zinc-900">
                      {formatBytes(org.storageBytes)}
                    </td>
                    <td className="py-3 pr-4 text-zinc-700">
                      {org.monthlyCostEur != null ? formatEur(org.monthlyCostEur) : "—"}
                    </td>
                    <td className="py-3 pr-4 font-medium text-zinc-900">
                      {org.status === "APPROVED"
                        ? formatEur(org.walletBalanceCents / 100)
                        : "—"}
                    </td>
                    <td className="py-3">
                      {org.status === "PENDING" ? (
                        <div className="flex min-w-[12rem] flex-col gap-2">
                          <form action={approveOrganization.bind(null, org.id)}>
                            <Button type="submit" size="sm" className="w-full">
                              {t("approve")}
                            </Button>
                          </form>
                          <form
                            action={rejectOrganizationForm.bind(null, org.id)}
                            className="flex flex-col gap-1.5"
                          >
                            <input
                              name="reason"
                              placeholder={t("rejectReason")}
                              className="rounded-md border border-zinc-200 px-2 py-1 text-xs"
                            />
                            <Button type="submit" size="sm" variant="destructive" className="w-full">
                              {t("reject")}
                            </Button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
