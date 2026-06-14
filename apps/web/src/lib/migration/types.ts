import type { MigrationPhase, MigrationProvider, MigrationStatus } from "@prisma/client";

export type MigrationProgress = {
  percent: number;
  messagesSynced?: number;
  foldersSynced?: number;
  currentFolder?: string;
  lastLogLine?: string;
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

export const ACTIVE_MIGRATION_STATUSES: MigrationStatus[] = [
  "PENDING_OAUTH",
  "QUEUED",
  "RUNNING",
];

export const MIGRATION_ERROR_CODES = [
  "imapsync_not_found",
  "imapsync_failed",
  "target_credentials_missing",
  "source_credentials_missing",
  "oauth_refresh_failed",
  "mail_scope_disabled",
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
};
