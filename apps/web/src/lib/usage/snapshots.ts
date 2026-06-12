import type { UsageSnapshot } from "@prisma/client";

export type UsageHistoryRow = {
  monthKey: string;
  recordedAt: Date;
  storageBytes: bigint;
  mailboxCount: number;
  domainCount: number;
};

const PARIS_TZ = "Europe/Paris";

function monthKeyFromDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  return `${year}-${month}`;
}

export function formatUsageMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export function groupUsageSnapshotsByMonth(snapshots: UsageSnapshot[]): UsageHistoryRow[] {
  const groups = new Map<string, UsageHistoryRow>();

  for (const snapshot of snapshots) {
    const monthKey = monthKeyFromDate(snapshot.recordedAt);
    const row =
      groups.get(monthKey) ??
      ({
        monthKey,
        recordedAt: snapshot.recordedAt,
        storageBytes: BigInt(0),
        mailboxCount: 0,
        domainCount: 0,
      } satisfies UsageHistoryRow);

    if (snapshot.metric === "STORAGE_BYTES" && snapshot.value > row.storageBytes) {
      row.storageBytes = snapshot.value;
    }
    if (snapshot.metric === "MAILBOX_COUNT") {
      const count = Number(snapshot.value);
      if (count > row.mailboxCount) row.mailboxCount = count;
    }
    if (snapshot.metric === "DOMAIN_COUNT") {
      const count = Number(snapshot.value);
      if (count > row.domainCount) row.domainCount = count;
    }
    if (snapshot.recordedAt > row.recordedAt) {
      row.recordedAt = snapshot.recordedAt;
    }

    groups.set(monthKey, row);
  }

  return Array.from(groups.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}
