import type { MigrationPhase } from "@prisma/client";
import type { MigrationStatusPayload } from "@/lib/migration/types";

/** imapsync 2.323+ : « Host1: folder [INBOX] selected 42 messages, duplicates 0 » */
export const IMAPSYNC_HOST1_FOLDER_SCAN_RE =
  /Host1:\s+folder\s+(.+?)\s+selected\s+(\d+)\s+messages?(?:,\s*duplicates\s+\d+)?/i;
/** imapsync 2.323+ : « msg INBOX/12 {1234} copied to … » */
export const IMAPSYNC_MSG_COPIED_RE = /^msg\s+(.+?)\/(\d+)\s+\{/i;

const LEGACY_PROGRESS_RE = /(\d+)\s*\/\s*(\d+)\s+msgs/;

/** Lignes imapsync à ne jamais afficher ni persister dans le journal. */
export function isImapsyncJournalNoise(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return true;
  if (/Log file is LOG_imapsync/i.test(trimmed)) return true;
  if (/\bDEBUG\b/i.test(trimmed)) return true;
  if (/Undefined SSL object/i.test(trimmed)) return true;
  if (IMAPSYNC_HOST1_FOLDER_SCAN_RE.test(trimmed)) return true;
  if (/Host[12]:\s+folder\s+.+\s+selected\s+\d+\s+messages?/i.test(trimmed)) return true;
  if (/\bselected\s+\d+\s+messages?\b/i.test(trimmed) && /\bduplicates\s+\d+\b/i.test(trimmed)) {
    return true;
  }
  if (/^\S*(?:\/bin\/)?imapsync\s+--/i.test(trimmed)) return true;
  return false;
}

/** Ligne d'erreur imapsync exploitable (hors bruit journal). */
export function isImapsyncErrorLine(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed || isImapsyncJournalNoise(trimmed)) return false;
  if (/^Err \d+\/\d+:/i.test(trimmed)) return true;
  if (/\b(?:ERROR|FATAL)\b/i.test(trimmed)) return true;
  if (/\bExiting with /i.test(trimmed)) return true;
  return false;
}

/** Dernière erreur imapsync utile dans le journal (événements récents en premier). */
export function findLastImapsyncErrorInEvents(
  events: { message: string }[]
): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const msg = events[i]!.message;
    if (isImapsyncErrorLine(msg)) return msg.trim();
  }
  return null;
}

/**
 * errorMessage DB parfois pollué (ex. « Log file is … » en fin de sync).
 * Retombe sur le journal ou sur le code imapsync_failed.
 */
export function resolveMigrationErrorMessage(
  errorMessage: string | null,
  events: { message: string }[]
): string | null {
  if (!errorMessage) return null;
  const trimmed = errorMessage.trim();
  if (!isImapsyncJournalNoise(trimmed)) return trimmed;
  return findLastImapsyncErrorInEvents(events) ?? "imapsync_failed";
}

/** Journal migration : messages copiés, erreurs et fin uniquement. */
export function shouldLogImapsyncLine(line: string): boolean {
  if (isImapsyncJournalNoise(line)) return false;
  const trimmed = line.trim();
  if (IMAPSYNC_MSG_COPIED_RE.test(trimmed)) return true;
  if (LEGACY_PROGRESS_RE.test(trimmed)) return true;
  if (/^Err \d+\/\d+:/i.test(trimmed)) return true;
  if (/\bERROR\b/i.test(trimmed)) return true;
  if (/\bFATAL\b/i.test(trimmed)) return true;
  if (/\bExiting with /i.test(trimmed)) return true;
  if (/^End of sync/i.test(trimmed)) return true;
  if (/^Messages transferred/i.test(trimmed)) return true;
  return false;
}

function decodeImapUtf7Segment(segment: string): string {
  let b64 = segment.replace(/,/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  const binary = atob(b64);
  let decoded = "";
  for (let j = 0; j + 1 < binary.length; j += 2) {
    decoded += String.fromCharCode((binary.charCodeAt(j) << 8) | binary.charCodeAt(j + 1));
  }
  return decoded;
}

/**
 * Décode un nom de dossier IMAP en modified UTF-7 (RFC 3501).
 * Ex. « Messages envoy&AOk-s » → « Messages envoyés », « &AMA- faire » → « À faire ».
 */
export function decodeImapFolderName(name: string): string {
  let result = "";
  let i = 0;
  while (i < name.length) {
    const amp = name.indexOf("&", i);
    if (amp === -1) {
      result += name.slice(i);
      break;
    }
    result += name.slice(i, amp);
    i = amp + 1;
    if (i >= name.length) {
      result += "&";
      break;
    }
    if (name[i] === "-") {
      result += "&";
      i += 1;
      continue;
    }
    const dash = name.indexOf("-", i);
    if (dash === -1) {
      result += `&${name.slice(i)}`;
      break;
    }
    const segment = name.slice(i, dash);
    if (segment) result += decodeImapUtf7Segment(segment);
    i = dash + 1;
  }
  return result;
}

/** Retire les préfixes IMAP type [[Gmail]/Important] → Important. */
export function formatMigrationFolderName(folder: string): string {
  const trimmed = decodeImapFolderName(folder.trim());
  const doubleBracket = trimmed.match(/^\[\[([^\]]+)\]\/(.+)\]$/);
  if (doubleBracket) return doubleBracket[2];
  const singleBracket = trimmed.match(/^\[([^\]]+)\]\/(.+)$/);
  if (singleBracket) return singleBracket[2];
  return trimmed;
}

/** Décode les noms de dossiers dans une ligne de journal imapsync. */
export function formatImapsyncJournalLine(line: string): string {
  const folderMatch = IMAPSYNC_HOST1_FOLDER_SCAN_RE.exec(line);
  if (folderMatch) {
    const raw = folderMatch[1]!.trim();
    return line.replace(raw, decodeImapFolderName(raw));
  }
  const copiedMatch = IMAPSYNC_MSG_COPIED_RE.exec(line);
  if (copiedMatch) {
    const raw = copiedMatch[1]!;
    return line.replace(raw, decodeImapFolderName(raw));
  }
  return line;
}

export function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

const SYSTEM_EVENT_CODES = new Set([
  "source_discovered",
  "migration_queued",
  "migration_started",
  "folder_scanning",
  "migration_completed",
  "migration_cancelled",
]);

const EVENT_I18N_KEYS = {
  source_discovered: "migration.event_source_discovered",
  migration_queued: "migration.event_migration_queued",
  migration_started: "migration.event_migration_started",
  folder_scanning: "migration.event_folder_scanning",
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
  return truncateText(formatImapsyncJournalLine(message), 120);
}

type MigrationEvent = MigrationStatusPayload["events"][number];

function insertSyntheticFolderScanEvent(
  events: MigrationEvent[],
  anchor: MigrationEvent
): MigrationEvent[] {
  const insertIdx = events.findIndex(
    (event) => new Date(event.createdAt) >= new Date(anchor.createdAt)
  );
  const synthetic: MigrationEvent = {
    id: `synthetic-folder-scan-${anchor.id}`,
    phase: anchor.phase,
    message: "folder_scanning",
    createdAt: anchor.createdAt,
  };
  if (insertIdx === -1) {
    return [...events, synthetic];
  }
  return [...events.slice(0, insertIdx), synthetic, ...events.slice(insertIdx)];
}

/** Filtre le bruit imapsync (anciens événements DB inclus) et déduplique. */
export function filterMigrationEvents(
  events: MigrationStatusPayload["events"]
): MigrationStatusPayload["events"] {
  const reversed = [...events].reverse();
  let seenSourceDiscovered = false;
  const seenMessages = new Set<string>();
  let sawFolderScanNoise = false;
  let folderScanAnchor: MigrationEvent | null = null;

  const filtered = reversed.filter((event) => {
    if (event.message !== "folder_scanning" && isImapsyncJournalNoise(event.message)) {
      if (IMAPSYNC_HOST1_FOLDER_SCAN_RE.test(event.message)) {
        sawFolderScanNoise = true;
        folderScanAnchor ??= event;
      }
      return false;
    }
    if (event.message === "source_discovered") {
      if (seenSourceDiscovered) return false;
      seenSourceDiscovered = true;
    }
    if (seenMessages.has(event.message)) return false;
    seenMessages.add(event.message);
    return true;
  });

  const chronological = filtered.reverse();
  const hasFolderScanEvent = chronological.some((event) => event.message === "folder_scanning");
  if (sawFolderScanNoise && !hasFolderScanEvent && folderScanAnchor) {
    return insertSyntheticFolderScanEvent(chronological, folderScanAnchor);
  }
  return chronological;
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

const ETA_MIN_SYNCED = 10;
const ETA_MIN_ELAPSED_MS = 30_000;
const ETA_MAX_MS = 7 * 24 * 60 * 60 * 1000;

export function formatDurationMs(ms: number): string {
  const capped = Math.min(ms, ETA_MAX_MS);
  const totalMinutes = Math.max(1, Math.ceil(capped / 60_000));
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
  if (!startedAt || synced < ETA_MIN_SYNCED || total <= synced) return null;
  const elapsed = Date.now() - new Date(startedAt).getTime();
  if (elapsed < ETA_MIN_ELAPSED_MS) return null;
  const rate = synced / elapsed;
  if (rate <= 0) return null;
  const remaining = total - synced;
  const eta = remaining / rate;
  if (!Number.isFinite(eta) || eta > ETA_MAX_MS) return null;
  return eta;
}

export function formatMigrationPercentLabel(percent: number, synced: number): string {
  if (synced > 0 && percent === 0) return "<1%";
  return `${percent}%`;
}

export function getMigrationProgressBarWidth(percent: number, synced: number): number {
  if (synced > 0 && percent === 0) return 0.5;
  return Math.min(100, Math.max(0, percent));
}

export function shouldShowMigrationEtaCalculating(
  synced: number,
  total: number,
  etaMs: number | null
): boolean {
  return synced > 0 && synced < total && etaMs == null;
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
