import type { MigrationPhase, MigrationProvider, MigrationStatus } from "@prisma/client";
import type { MigrationSourceStats } from "@/lib/migration/discovery/types";

export type MigrationProgress = {
  percent: number;
  messagesSynced?: number;
  foldersSynced?: number;
  currentFolder?: string;
  lastLogLine?: string;
  contactsSynced?: number;
  contactsTotal?: number;
  calendarSynced?: number;
  calendarTotal?: number;
};

export type MigrationScope = {
  mail: boolean;
  contacts: boolean;
  calendar: boolean;
};

export type ImapPreset = {
  host: string;
  port: number;
  label: string;
};

export type OAuthTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  email?: string;
};

export type ImapSourceCredentials = {
  host: string;
  port: number;
  user: string;
  password?: string;
  oauthAccessToken?: string;
  oauthProvider?: "google" | "microsoft";
  oauthClientId?: string;
};

export type MigrationStatusPayload = {
  id: string;
  mailboxId: string;
  provider: MigrationProvider;
  status: MigrationStatus;
  phase: MigrationPhase | null;
  sourceAddress: string | null;
  targetAddress: string;
  scopeMail: boolean;
  scopeContacts: boolean;
  scopeCalendar: boolean;
  progress: MigrationProgress | null;
  sourceStats: MigrationSourceStats | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  events: {
    id: string;
    phase: MigrationPhase | null;
    message: string;
    createdAt: string;
  }[];
};

/** Migration réellement lancée (badge, bannière, panneau de suivi). */
export const LAUNCHED_MIGRATION_STATUSES: MigrationStatus[] = ["QUEUED", "RUNNING"];

/** Migration terminée (succès, échec ou annulation). */
export const TERMINAL_MIGRATION_STATUSES: MigrationStatus[] = [
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

/** Durée d'affichage du chip sur la ligne utilisateur (7 jours). */
export const MIGRATION_CHIP_VISIBLE_MS = 7 * 24 * 60 * 60 * 1000;

/** Durée d'affichage du widget sidebar pour une migration terminée (48 h). */
export const MIGRATION_SIDEBAR_RECENT_MS = 48 * 60 * 60 * 1000;

/** Brouillon wizard (OAuth / choix du périmètre) — pas une migration en cours. */
export const DRAFT_MIGRATION_STATUSES: MigrationStatus[] = ["PENDING_OAUTH"];

/** Statuts bloquant une nouvelle migration sur la même boîte. */
export const BLOCKING_MIGRATION_STATUSES: MigrationStatus[] = [
  ...DRAFT_MIGRATION_STATUSES,
  ...LAUNCHED_MIGRATION_STATUSES,
];

/** @deprecated Utiliser LAUNCHED_MIGRATION_STATUSES ou BLOCKING_MIGRATION_STATUSES. */
export const ACTIVE_MIGRATION_STATUSES = LAUNCHED_MIGRATION_STATUSES;

export function isLaunchedMigrationStatus(status: MigrationStatus): boolean {
  return LAUNCHED_MIGRATION_STATUSES.includes(status);
}

export function isTerminalMigrationStatus(status: MigrationStatus): boolean {
  return TERMINAL_MIGRATION_STATUSES.includes(status);
}

function isWithinMs(isoDate: string | null, windowMs: number): boolean {
  if (!isoDate) return false;
  return Date.now() - new Date(isoDate).getTime() <= windowMs;
}

/** Chip visible sur la ligne utilisateur (actif ou terminé depuis ≤ 7 jours). */
export function isChipVisibleMigration(migration: MigrationStatusPayload): boolean {
  if (isLaunchedMigrationStatus(migration.status)) return true;
  if (!isTerminalMigrationStatus(migration.status)) return false;
  return isWithinMs(migration.completedAt, MIGRATION_CHIP_VISIBLE_MS);
}

/** Widget sidebar : migration active ou terminée (succès/échec) depuis ≤ 48 h. */
export function isSidebarVisibleMigration(migration: MigrationStatusPayload): boolean {
  if (isLaunchedMigrationStatus(migration.status)) return true;
  if (migration.status !== "COMPLETED" && migration.status !== "FAILED") return false;
  return isWithinMs(migration.completedAt, MIGRATION_SIDEBAR_RECENT_MS);
}

export function isDraftMigrationStatus(status: MigrationStatus): boolean {
  return DRAFT_MIGRATION_STATUSES.includes(status);
}

export type MigrationWizardStep = "provider" | "credentials" | "auth" | "scope" | "confirm" | "status";

/** Reprendu à l'étape wizard appropriée pour un brouillon PENDING_OAUTH. */
export function resolveDraftWizardStep(
  draft: MigrationStatusPayload,
  options?: { hasCredentials?: boolean; authExpired?: boolean }
): Exclude<MigrationWizardStep, "confirm" | "status"> {
  const hasCredentials = options?.hasCredentials ?? false;
  const oauthProvider = draft.provider === "GOOGLE" || draft.provider === "MICROSOFT";

  if (oauthProvider) {
    if (options?.authExpired && hasCredentials) return "auth";
    if (hasCredentials || draft.sourceAddress) return "scope";
    return "provider";
  }

  if (draft.sourceAddress || hasCredentials) return "scope";
  if (draft.provider === "ICLOUD" || draft.provider === "IMAP_GENERIC") {
    return "credentials";
  }
  return "provider";
}

export type MigrationWizardEntry = {
  migration: MigrationStatusPayload;
  step: MigrationWizardStep;
  existingAuth: boolean;
  authExpired: boolean;
};

export const MIGRATION_ERROR_CODES = [
  "imapsync_not_found",
  "imapsync_failed",
  "target_credentials_missing",
  "source_credentials_missing",
  "oauth_refresh_failed",
  "mail_scope_disabled",
  "no_scope_selected",
  "contacts_import_failed",
  "calendar_import_failed",
  "contacts_not_supported",
  "calendar_not_supported",
] as const;

export type MigrationErrorCode = (typeof MIGRATION_ERROR_CODES)[number];

export function isMigrationErrorCode(code: string): code is MigrationErrorCode {
  return (MIGRATION_ERROR_CODES as readonly string[]).includes(code);
}

export const MIGRATION_ERROR_I18N_KEYS: Record<
  MigrationErrorCode,
  `migration.error_${MigrationErrorCode}`
> = {
  imapsync_not_found: "migration.error_imapsync_not_found",
  imapsync_failed: "migration.error_imapsync_failed",
  target_credentials_missing: "migration.error_target_credentials_missing",
  source_credentials_missing: "migration.error_source_credentials_missing",
  oauth_refresh_failed: "migration.error_oauth_refresh_failed",
  mail_scope_disabled: "migration.error_mail_scope_disabled",
  no_scope_selected: "migration.error_no_scope_selected",
  contacts_import_failed: "migration.error_contacts_import_failed",
  calendar_import_failed: "migration.error_calendar_import_failed",
  contacts_not_supported: "migration.error_contacts_not_supported",
  calendar_not_supported: "migration.error_calendar_not_supported",
};
