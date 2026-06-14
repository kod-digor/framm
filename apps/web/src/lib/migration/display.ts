import type { MigrationPhase } from "@prisma/client";
import type { MigrationStatusPayload } from "@/lib/migration/types";

/** Retire les préfixes IMAP type [[Gmail]/Important] → Important. */
export function formatMigrationFolderName(folder: string): string {
  const trimmed = folder.trim();
  const doubleBracket = trimmed.match(/^\[\[([^\]]+)\]\/(.+)\]$/);
  if (doubleBracket) return doubleBracket[2];
  const singleBracket = trimmed.match(/^\[([^\]]+)\]\/(.+)$/);
  if (singleBracket) return singleBracket[2];
  return trimmed;
}

export function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

const SYSTEM_EVENT_CODES = new Set([
  "source_discovered",
  "migration_queued",
  "migration_started",
  "migration_completed",
  "migration_cancelled",
]);

const EVENT_I18N_KEYS = {
  source_discovered: "migration.event_source_discovered",
  migration_queued: "migration.event_migration_queued",
  migration_started: "migration.event_migration_started",
  migration_completed: "migration.event_migration_completed",
  migration_cancelled: "migration.event_migration_cancelled",
} as const;

export function isMigrationSystemEvent(message: string): boolean {
  return SYSTEM_EVENT_CODES.has(message);
}

export function formatMigrationEventMessage(
  message: string,
  translate: (key: (typeof EVENT_I18N_KEYS)[keyof typeof EVENT_I18N_KEYS]) => string
): string {
  if (message in EVENT_I18N_KEYS) {
    return translate(EVENT_I18N_KEYS[message as keyof typeof EVENT_I18N_KEYS]);
  }
  return truncateText(message, 120);
}

/** Garde un seul événement source_discovered (le plus récent). */
export function filterMigrationEvents(
  events: MigrationStatusPayload["events"]
): MigrationStatusPayload["events"] {
  const reversed = [...events].reverse();
  let seenSourceDiscovered = false;
  const filtered = reversed.filter((event) => {
    if (event.message === "source_discovered") {
      if (seenSourceDiscovered) return false;
      seenSourceDiscovered = true;
    }
    return true;
  });
  return filtered.reverse();
}

export function formatRelativeTimeFr(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 10) return "à l'instant";
  if (seconds < 60) return `il y a ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

export function formatDurationMs(ms: number): string {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60_000));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const remMin = totalMinutes % 60;
  if (remMin === 0) return `${hours} h`;
  return `${hours} h ${remMin} min`;
}

export function estimateMigrationEtaMs(
  startedAt: string | null,
  synced: number,
  total: number
): number | null {
  if (!startedAt || synced <= 0 || total <= synced) return null;
  const elapsed = Date.now() - new Date(startedAt).getTime();
  if (elapsed <= 0) return null;
  const rate = synced / elapsed;
  const remaining = total - synced;
  return remaining / rate;
}

export type MigrationProgressSummary =
  | { kind: "messages"; synced: number; total: number }
  | { kind: "contacts"; synced: number; total: number }
  | { kind: "calendar"; synced: number; total: number }
  | { kind: "phase"; phase: MigrationPhase | null };

export function getMigrationProgressSummary(
  status: MigrationStatusPayload
): MigrationProgressSummary {
  const progress = status.progress;
  if (status.phase === "SYNCING_CONTACTS" && progress?.contactsTotal) {
    return {
      kind: "contacts",
      synced: progress.contactsSynced ?? 0,
      total: progress.contactsTotal,
    };
  }
  if (status.phase === "SYNCING_CALENDAR" && progress?.calendarTotal) {
    return {
      kind: "calendar",
      synced: progress.calendarSynced ?? 0,
      total: progress.calendarTotal,
    };
  }
  if (
    progress?.messagesSynced != null &&
    status.sourceStats?.mail.messageCount
  ) {
    return {
      kind: "messages",
      synced: progress.messagesSynced,
      total: status.sourceStats.mail.messageCount,
    };
  }
  return { kind: "phase", phase: status.phase };
}
