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
