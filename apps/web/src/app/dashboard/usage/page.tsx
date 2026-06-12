import { getOrgId, requireOrgAdmin } from "@/lib/auth-utils";
import {
  estimateStorageCostEur,
  formatEur,
  getLatestPricing,
  syncPricingIfStale,
} from "@/lib/billing/pricing";
import { prisma } from "@/lib/prisma";
import { getOrgStorageBytes } from "@/lib/storage/s3";
import {
  formatUsageMonthLabel,
  groupUsageSnapshotsByMonth,
} from "@/lib/usage/snapshots";
import { formatBytes } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/t";

function formatRecordedAt(date: Date) {
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function UsagePage() {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session)!;
  const t = await getT("usage");

  const [storage, mailboxCount, domainCount, snapshots, latestPricing] = await Promise.all([
    getOrgStorageBytes(orgId),
    prisma.mailbox.count({ where: { organizationId: orgId } }),
    prisma.domain.count({
      where: { organizationId: orgId, status: { in: ["VERIFIED", "ACTIVE"] } },
    }),
    prisma.usageSnapshot.findMany({
      where: { organizationId: orgId },
      orderBy: { recordedAt: "desc" },
      take: 1095,
    }),
    getLatestPricing(),
  ]);

  const pricing = latestPricing ?? (await syncPricingIfStale());

  const history = groupUsageSnapshotsByMonth(snapshots);
  const monthlyEstimate = pricing
    ? estimateStorageCostEur(storage, pricing.storageEurPerGbMonth)
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("storage")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatBytes(storage)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("mailboxes")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{mailboxCount}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("domains")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{domainCount}</CardContent>
        </Card>
      </div>

      {pricing && (
        <Card>
          <CardHeader>
            <CardTitle>{t("billingTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-zinc-600">
            <p className="text-2xl font-bold text-zinc-900">
              {monthlyEstimate != null ? formatEur(monthlyEstimate) : "—"}
              <span className="ml-2 text-sm font-normal text-zinc-500">{t("perMonthHt")}</span>
            </p>
            <p>
              {t("rateLine", {
                rate: formatEur(pricing.storageEurPerGbMonth),
                region: pricing.region,
              })}
            </p>
            <p className="text-xs text-zinc-500">
              {t("rateUpdated", { date: formatRecordedAt(pricing.fetchedAt) })}
            </p>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("history")}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="border-b text-zinc-500">
                  <th className="pb-2 pr-4 font-medium">{t("colMonth")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("colStorage")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("colMailboxes")}</th>
                  <th className="pb-2 font-medium">{t("colDomains")}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.monthKey} className="border-b border-zinc-100">
                    <td className="py-2 pr-4 text-zinc-700">
                      {formatUsageMonthLabel(row.monthKey)}
                    </td>
                    <td className="py-2 pr-4 font-medium text-zinc-900">
                      {formatBytes(row.storageBytes)}
                    </td>
                    <td className="py-2 pr-4 text-zinc-700">{row.mailboxCount}</td>
                    <td className="py-2 text-zinc-700">{row.domainCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {history.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("history")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-500">{t("historyEmpty")}</CardContent>
        </Card>
      )}
    </div>
  );
}
