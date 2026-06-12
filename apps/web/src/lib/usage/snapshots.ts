import type { UsageSnapshot } from "@prisma/client";

export type UsageHistoryRow = {
  recordedAt: Date;
  storageBytes: bigint;
  mailboxCount: number;
  domainCount: number;
};

function groupKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

export function groupUsageSnapshots(snapshots: UsageSnapshot[]): UsageHistoryRow[] {
  const groups = new Map<string, UsageHistoryRow>();

  for (const snapshot of snapshots) {
    const key = groupKey(snapshot.recordedAt);
    const row =
      groups.get(key) ??
      ({
        recordedAt: snapshot.recordedAt,
        storageBytes: BigInt(0),
        mailboxCount: 0,
        domainCount: 0,
      } satisfies UsageHistoryRow);

    if (snapshot.metric === "STORAGE_BYTES") row.storageBytes = snapshot.value;
    if (snapshot.metric === "MAILBOX_COUNT") row.mailboxCount = Number(snapshot.value);
    if (snapshot.metric === "DOMAIN_COUNT") row.domainCount = Number(snapshot.value);

    groups.set(key, row);
  }

  return Array.from(groups.values()).sort(
    (a, b) => b.recordedAt.getTime() - a.recordedAt.getTime()
  );
}
