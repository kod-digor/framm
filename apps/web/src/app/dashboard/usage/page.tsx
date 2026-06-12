import { ConsumptionChart, type ConsumptionChartPoint } from "@/components/usage/consumption-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrgId, requireOrgAdmin } from "@/lib/auth-utils";
import { computeMonthlyInvoice } from "@/lib/billing/invoice";
import {
  estimateStorageCostEur,
  formatEur,
  getLatestPricing,
  syncPricingIfStale,
} from "@/lib/billing/pricing";
import { getWalletSummary } from "@/lib/billing/wallet";
import { getT } from "@/i18n/t";
import { prisma } from "@/lib/prisma";
import { getOrgStorageBytes } from "@/lib/storage/s3";
import {
  formatUsageMonthLabel,
  getCurrentMonthKey,
  groupUsageSnapshotsByMonth,
  mergeLivePeakIntoCurrentMonth,
} from "@/lib/usage/snapshots";
import { formatBytes } from "@/lib/utils";

function formatRecordedAt(date: Date) {
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function storageGbFromBytes(bytes: bigint): number {
  return Number(bytes) / 1_073_741_824;
}

export default async function UsagePage() {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session)!;
  const t = await getT("usage");

  const [storage, mailboxCount, domainCount, snapshots, latestPricing, wallet] =
    await Promise.all([
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
      getWalletSummary(orgId),
    ]);

  const pricing = latestPricing ?? (await syncPricingIfStale());
  const currentMonthKey = getCurrentMonthKey();

  const history = mergeLivePeakIntoCurrentMonth(groupUsageSnapshotsByMonth(snapshots), {
    storageBytes: storage,
    mailboxCount,
    domainCount,
  });

  const invoices = pricing
    ? history.map((row) => ({
        row,
        invoice: computeMonthlyInvoice(row, pricing.storageEurPerGbMonth),
      }))
    : [];

  const chartData: ConsumptionChartPoint[] = [...invoices]
    .reverse()
    .map(({ row, invoice }) => ({
      monthKey: row.monthKey,
      monthLabel: formatUsageMonthLabel(row.monthKey),
      storageEur: invoice.storageEur,
      cardFeeEur: 0,
      totalEur: invoice.storageEur,
      storageGb: storageGbFromBytes(row.storageBytes),
    }));

  const monthlyEstimate = pricing
    ? estimateStorageCostEur(storage, pricing.storageEurPerGbMonth)
    : null;

  const { initialDeposit, nextRecharge, avgMonthlyConsumptionEur } = wallet;
  const autoRechargeAboveMinimum = avgMonthlyConsumptionEur > 10;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("walletBalance")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatEur(wallet.balanceEur)}</p>
            <p className="mt-2 text-xs text-zinc-500">{t("walletBalanceHint")}</p>
          </CardContent>
        </Card>
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

      <Card>
        <CardHeader>
          <CardTitle>{t("walletTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-zinc-600">
          <p>{t("walletIntro")}</p>
          <p>
            {t("walletInitialDeposit", {
              gross: formatEur(initialDeposit.grossEur),
              fee: formatEur(initialDeposit.feeEur),
              net: formatEur(initialDeposit.netEur),
            })}
          </p>
          <p>{t("walletConsumption")}</p>
          {autoRechargeAboveMinimum ? (
            <p>
              {t("walletAutoRechargeHigh", {
                avg: formatEur(avgMonthlyConsumptionEur),
                gross: formatEur(nextRecharge.grossEur),
                fee: formatEur(nextRecharge.feeEur),
                net: formatEur(nextRecharge.netEur),
              })}
            </p>
          ) : (
            <p>
              {t("walletAutoRechargeLow", {
                gross: formatEur(nextRecharge.grossEur),
                fee: formatEur(nextRecharge.feeEur),
                net: formatEur(nextRecharge.netEur),
              })}
            </p>
          )}
        </CardContent>
      </Card>

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
            <p>{t("billingWalletNote")}</p>
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

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("chartTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ConsumptionChart data={chartData} />
            <p className="mt-3 text-xs text-zinc-500">{t("chartHint")}</p>
          </CardContent>
        </Card>
      )}

      {invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("invoiceHistory")}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead>
                <tr className="border-b text-zinc-500">
                  <th className="pb-2 pr-4 font-medium">{t("colMonth")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("colStoragePeak")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("colMailboxesPeak")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("colDomainsPeak")}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t("colConsumption")}</th>
                  <th className="pb-2 text-right font-medium">{t("colWalletDebit")}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(({ row, invoice }) => {
                  const isCurrentMonth = row.monthKey === currentMonthKey;

                  return (
                    <tr key={row.monthKey} className="border-b border-zinc-100">
                      <td className="py-2 pr-4 text-zinc-700">
                        {formatUsageMonthLabel(row.monthKey)}
                        {isCurrentMonth && (
                          <span className="ml-2 text-xs text-zinc-500">{t("currentMonth")}</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 font-medium text-zinc-900">
                        {formatBytes(row.storageBytes)}
                      </td>
                      <td className="py-2 pr-4 text-zinc-700">{row.mailboxCount}</td>
                      <td className="py-2 pr-4 text-zinc-700">{row.domainCount}</td>
                      <td className="py-2 pr-4 text-right text-zinc-700">
                        {formatEur(invoice.storageEur)}
                      </td>
                      <td className="py-2 text-right font-medium text-zinc-900">
                        {isCurrentMonth ? "—" : formatEur(invoice.storageEur)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-zinc-500">{t("invoiceHint")}</p>
          </CardContent>
        </Card>
      )}

      {invoices.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("invoiceHistory")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-500">{t("historyEmpty")}</CardContent>
        </Card>
      )}
    </div>
  );
}
