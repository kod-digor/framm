import type { MigrationPhase, MigrationProvider, MigrationStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sealSecret } from "@/lib/crypto/seal";
import type {
  ImapSourceCredentials,
  MigrationProgress,
  MigrationScope,
  MigrationStatusPayload,
  OAuthTokens,
} from "@/lib/migration/types";
import {
  BLOCKING_MIGRATION_STATUSES,
  DRAFT_MIGRATION_STATUSES,
  isMigrationErrorCode,
  LAUNCHED_MIGRATION_STATUSES,
} from "@/lib/migration/types";
import {
  parseSourceStatsJson,
  type MigrationSourceStats,
} from "@/lib/migration/discovery/types";
import {
  isImapsyncJournalNoise,
  resolveMigrationErrorMessage,
} from "@/lib/migration/display";
import {
  parseImapsyncProgressLine,
  pickImapsyncFailureError,
  redactImapsyncLogLine,
} from "@/lib/migration/imapsync-runner";

function parseProgressJson(value: unknown): MigrationProgress | null {
  if (!value || typeof value !== "object") return null;
  const p = value as MigrationProgress;
  if (typeof p.percent !== "number") return null;
  return p;
}

export function serializeMigrationStatus(
  migration: {
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
    progressJson: unknown;
    sourceStatsJson?: unknown;
    errorMessage: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    events: {
      id: string;
      phase: MigrationPhase | null;
      message: string;
      createdAt: Date;
    }[];
  }
): MigrationStatusPayload {
  return {
    id: migration.id,
    mailboxId: migration.mailboxId,
    provider: migration.provider,
    status: migration.status,
    phase: migration.phase,
    sourceAddress: migration.sourceAddress,
    targetAddress: migration.targetAddress,
    scopeMail: migration.scopeMail,
    scopeContacts: migration.scopeContacts,
    scopeCalendar: migration.scopeCalendar,
    progress: parseProgressJson(migration.progressJson),
    sourceStats: parseSourceStatsJson(migration.sourceStatsJson),
    errorMessage: (() => {
      const resolved = resolveMigrationErrorMessage(
        migration.errorMessage,
        migration.events
      );
      return resolved ? redactImapsyncLogLine(resolved) : null;
    })(),
    startedAt: migration.startedAt?.toISOString() ?? null,
    completedAt: migration.completedAt?.toISOString() ?? null,
    events: migration.events.map((e) => ({
      id: e.id,
      phase: e.phase,
      message: redactImapsyncLogLine(e.message),
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

type MigrationStatusRecord = Parameters<typeof serializeMigrationStatus>[0];

/** Recalcule la progression mail depuis le journal si progressJson est bloqué à 0 %. */
export async function resolveLiveMailProgress(
  migration: Pick<
    MigrationStatusRecord,
    "id" | "status" | "phase" | "progressJson" | "sourceStatsJson"
  >
): Promise<MigrationProgress | null> {
  const stored = parseProgressJson(migration.progressJson);
  if (migration.status !== "RUNNING" || migration.phase !== "SYNCING_MAIL") {
    return stored;
  }
  if (stored && stored.percent > 0) return stored;

  const totalMessages = parseSourceStatsJson(migration.sourceStatsJson)?.mail.messageCount;
  if (!totalMessages) return stored;

  const mailEvents = await prisma.migrationEvent.findMany({
    where: { migrationId: migration.id, phase: "SYNCING_MAIL" },
    orderBy: { createdAt: "asc" },
    select: { message: true },
  });

  let state = {
    progress: { percent: 0 } as MigrationProgress,
    copiedKeys: new Set<string>(),
    foldersSeen: new Set<string>(),
  };

  for (const event of mailEvents) {
    state = parseImapsyncProgressLine(event.message, state, totalMessages);
  }

  if ((state.progress.messagesSynced ?? 0) === 0) return stored;
  return state.progress;
}

export async function serializeMigrationStatusWithLiveProgress(
  migration: MigrationStatusRecord
): Promise<MigrationStatusPayload> {
  const payload = serializeMigrationStatus(migration);
  const liveProgress = await resolveLiveMailProgress(migration);
  if (liveProgress) {
    payload.progress = liveProgress;
  }
  return payload;
}

const migrationWithEventsInclude = {
  events: { orderBy: { createdAt: "asc" as const }, take: 50 },
};

export async function getLaunchedMigrationForMailbox(mailboxId: string) {
  return prisma.mailboxMigration.findFirst({
    where: {
      mailboxId,
      status: { in: LAUNCHED_MIGRATION_STATUSES },
    },
    orderBy: { createdAt: "desc" },
    include: migrationWithEventsInclude,
  });
}

export async function getActiveMigrationForMailbox(mailboxId: string) {
  return getLaunchedMigrationForMailbox(mailboxId);
}

export async function getDraftMigrationForMailbox(mailboxId: string) {
  return prisma.mailboxMigration.findFirst({
    where: {
      mailboxId,
      status: { in: DRAFT_MIGRATION_STATUSES },
    },
    orderBy: { createdAt: "desc" },
    include: migrationWithEventsInclude,
  });
}

export async function getMigrationById(migrationId: string) {
  return prisma.mailboxMigration.findUnique({
    where: { id: migrationId },
    include: migrationWithEventsInclude,
  });
}

export async function getLaunchedMigrationsForOrg(organizationId: string) {
  return prisma.mailboxMigration.findMany({
    where: {
      organizationId,
      status: { in: LAUNCHED_MIGRATION_STATUSES },
    },
    orderBy: { createdAt: "desc" },
    include: migrationWithEventsInclude,
  });
}

export async function getActiveMigrationsForOrg(organizationId: string) {
  return getLaunchedMigrationsForOrg(organizationId);
}

export async function cancelStaleDraftMigrations(
  organizationId: string,
  maxAgeMs = 24 * 60 * 60 * 1000
) {
  const cutoff = new Date(Date.now() - maxAgeMs);
  const stale = await prisma.mailboxMigration.findMany({
    where: {
      organizationId,
      status: { in: DRAFT_MIGRATION_STATUSES },
      createdAt: { lt: cutoff },
    },
    select: { id: true },
  });

  for (const migration of stale) {
    await cancelMigration(migration.id);
  }

  return stale.length;
}

export async function createMigrationDraft(params: {
  organizationId: string;
  mailboxId: string;
  targetAddress: string;
  provider: MigrationProvider;
  sourceAddress?: string | null;
}) {
  const existing = await prisma.mailboxMigration.findFirst({
    where: {
      mailboxId: params.mailboxId,
      status: { in: BLOCKING_MIGRATION_STATUSES },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  return prisma.mailboxMigration.create({
    data: {
      organizationId: params.organizationId,
      mailboxId: params.mailboxId,
      provider: params.provider,
      targetAddress: params.targetAddress,
      sourceAddress: params.sourceAddress ?? null,
      status: "PENDING_OAUTH",
    },
  });
}

export async function logMigrationEvent(
  migrationId: string,
  message: string,
  phase?: MigrationPhase,
  metadata?: Record<string, unknown>
) {
  const safeMessage = redactImapsyncLogLine(message).slice(0, 500);
  await prisma.migrationEvent.create({
    data: {
      migrationId,
      message: safeMessage,
      phase,
      metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
    },
  });
}

export async function storeImapCredentials(
  migrationId: string,
  credentials: ImapSourceCredentials,
  sourceAddress?: string
) {
  const enc = await sealSecret(JSON.stringify(credentials));
  await prisma.mailboxMigration.update({
    where: { id: migrationId },
    data: {
      sourceCredentialsEnc: enc,
      sourceAddress: sourceAddress ?? credentials.user,
      status: "PENDING_OAUTH",
    },
  });
}

export async function storeOAuthTokens(
  migrationId: string,
  tokens: OAuthTokens,
  imapUser: string,
  oauthProvider: "google" | "microsoft"
) {
  const sourceCreds: ImapSourceCredentials = {
    host:
      oauthProvider === "google" ? "imap.gmail.com" : "outlook.office365.com",
    port: 993,
    user: imapUser,
    oauthAccessToken: tokens.accessToken,
    oauthProvider,
  };

  const existing = await prisma.mailboxMigration.findUnique({
    where: { id: migrationId },
    select: { oauthRefreshTokenEnc: true },
  });

  const sourceEnc = await sealSecret(JSON.stringify(sourceCreds));
  const refreshEnc = tokens.refreshToken
    ? await sealSecret(tokens.refreshToken)
    : existing?.oauthRefreshTokenEnc ?? null;

  await prisma.mailboxMigration.update({
    where: { id: migrationId },
    data: {
      sourceCredentialsEnc: sourceEnc,
      oauthRefreshTokenEnc: refreshEnc,
      sourceAddress: tokens.email ?? imapUser,
      sourceStatsJson: Prisma.DbNull,
      status: "PENDING_OAUTH",
    },
  });
}

export async function storeSourceStats(
  migrationId: string,
  stats: MigrationSourceStats
) {
  const existing = await prisma.mailboxMigration.findUnique({
    where: { id: migrationId },
    select: { sourceStatsJson: true },
  });
  const hadStats = !!parseSourceStatsJson(existing?.sourceStatsJson)?.discoveredAt;

  await prisma.mailboxMigration.update({
    where: { id: migrationId },
    data: {
      sourceStatsJson: stats as unknown as Prisma.InputJsonValue,
    },
  });

  if (!hadStats) {
    await logMigrationEvent(migrationId, "source_discovered");
  }
}

export async function queueMigration(
  migrationId: string,
  scope: MigrationScope,
  sourceAddress?: string
) {
  await prisma.mailboxMigration.update({
    where: { id: migrationId },
    data: {
      scopeMail: scope.mail,
      scopeContacts: scope.contacts,
      scopeCalendar: scope.calendar,
      sourceAddress: sourceAddress ?? undefined,
      status: "QUEUED",
      phase: "CONNECTING",
      progressJson: { percent: 0 },
      errorMessage: null,
    },
  });

  await logMigrationEvent(migrationId, "migration_queued", "CONNECTING");
}

export async function retryMigration(migrationId: string) {
  await prisma.mailboxMigration.update({
    where: { id: migrationId },
    data: {
      status: "QUEUED",
      phase: "CONNECTING",
      progressJson: { percent: 0 },
      errorMessage: null,
      startedAt: null,
      completedAt: null,
    },
  });

  await logMigrationEvent(migrationId, "migration_queued", "CONNECTING");
}

export async function cancelMigration(migrationId: string) {
  await prisma.mailboxMigration.update({
    where: { id: migrationId },
    data: {
      status: "CANCELLED",
      completedAt: new Date(),
    },
  });
  await logMigrationEvent(migrationId, "migration_cancelled");
}

export async function markMigrationRunning(migrationId: string, firstPhase: MigrationPhase = "SYNCING_MAIL") {
  await prisma.mailboxMigration.update({
    where: { id: migrationId },
    data: {
      status: "RUNNING",
      phase: firstPhase,
      startedAt: new Date(),
      progressJson: { percent: 0, lastLogLine: "migration_started" },
    },
  });
  await logMigrationEvent(migrationId, "migration_started", firstPhase);
}

export async function updateMigrationProgress(
  migrationId: string,
  progress: MigrationProgress,
  phase?: MigrationPhase
) {
  await prisma.mailboxMigration.update({
    where: { id: migrationId },
    data: {
      progressJson: progress,
      phase: phase ?? undefined,
    },
  });
}

export async function completeMigration(migrationId: string) {
  await prisma.mailboxMigration.update({
    where: { id: migrationId },
    data: {
      status: "COMPLETED",
      phase: "FINALIZING",
      completedAt: new Date(),
      progressJson: { percent: 100 },
      sourceCredentialsEnc: null,
      oauthRefreshTokenEnc: null,
    },
  });
  await logMigrationEvent(migrationId, "migration_completed", "FINALIZING");
}

export async function failMigration(migrationId: string, error: string) {
  const storedError = pickImapsyncFailureError(error, undefined);
  await prisma.mailboxMigration.update({
    where: { id: migrationId },
    data: {
      status: "FAILED",
      errorMessage: storedError,
      completedAt: new Date(),
    },
  });
  if (!isImapsyncJournalNoise(storedError) && !isMigrationErrorCode(storedError)) {
    await logMigrationEvent(migrationId, storedError);
  }
}

export async function wipeMigrationSecrets(migrationId: string) {
  await prisma.mailboxMigration.update({
    where: { id: migrationId },
    data: {
      sourceCredentialsEnc: null,
      oauthRefreshTokenEnc: null,
    },
  });
}
