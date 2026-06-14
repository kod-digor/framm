import { prisma } from "@/lib/prisma";
import { unsealSecret } from "@/lib/crypto/seal";
import {
  decodeSourceCredentials,
  redactImapsyncLogLine,
  runImapsync,
  shouldLogImapsyncLine,
} from "@/lib/migration/imapsync-runner";
import { runContactsMigration } from "@/lib/migration/contacts-runner";
import { runCalendarMigration } from "@/lib/migration/calendar-runner";
import {
  completeMigration,
  failMigration,
  logMigrationEvent,
  markMigrationRunning,
  updateMigrationProgress,
} from "@/lib/migration/orchestrator";
import { refreshGoogleAccessToken } from "@/lib/migration/providers/google";
import { refreshMicrosoftAccessToken } from "@/lib/migration/providers/microsoft";
import { parseSourceStatsJson } from "@/lib/migration/discovery/types";
import type { ImapSourceCredentials, MigrationProgress } from "@/lib/migration/types";
import type { MigrationPhase } from "@prisma/client";

const POLL_INTERVAL_MS = 15_000;
const DEFAULT_WORKER_CONCURRENCY = 1;

function resolveWorkerConcurrency(): number {
  const raw = Number(process.env.MIGRATION_WORKER_CONCURRENCY ?? DEFAULT_WORKER_CONCURRENCY);
  if (!Number.isFinite(raw)) return DEFAULT_WORKER_CONCURRENCY;
  return Math.min(4, Math.max(1, Math.round(raw)));
}

function resolveStalwartImapHost(): string {
  const url = process.env.STALWART_URL ?? process.env.WEBMAIL_URL ?? "";
  try {
    if (url) return new URL(url).hostname;
  } catch {
    // ignore
  }
  return "localhost";
}

function computeWeights(scopeMail: boolean, scopeContacts: boolean, scopeCalendar: boolean) {
  const count = [scopeMail, scopeContacts, scopeCalendar].filter(Boolean).length;
  const weight = count > 0 ? Math.floor(100 / count) : 0;
  let mail = 0;
  let contacts = 0;
  let calendar = 0;
  let offset = 0;

  if (scopeMail) {
    mail = weight;
    offset += weight;
  }
  if (scopeContacts) {
    contacts = weight;
    offset += weight;
  }
  if (scopeCalendar) {
    calendar = 100 - offset;
  }

  return { mail, contacts, calendar };
}

async function refreshOAuthIfNeeded(
  source: ImapSourceCredentials,
  oauthRefreshTokenEnc: string | null
): Promise<ImapSourceCredentials | null> {
  if (!source.oauthProvider || !oauthRefreshTokenEnc) return source;

  const refreshToken = unsealSecret(oauthRefreshTokenEnc);
  if (!refreshToken) return source;

  const refreshed =
    source.oauthProvider === "google"
      ? await refreshGoogleAccessToken(refreshToken)
      : await refreshMicrosoftAccessToken(refreshToken);

  if (!refreshed?.accessToken) return source;

  return {
    ...source,
    oauthAccessToken: refreshed.accessToken,
  };
}

async function processMigration(migrationId: string) {
  const migration = await prisma.mailboxMigration.findUnique({
    where: { id: migrationId },
    include: { mailbox: true },
  });

  if (!migration || migration.status !== "QUEUED") return;

  if (!migration.scopeMail && !migration.scopeContacts && !migration.scopeCalendar) {
    await failMigration(migrationId, "no_scope_selected");
    return;
  }

  const mailboxPassword = migration.mailbox.credentialsEnc
    ? unsealSecret(migration.mailbox.credentialsEnc)
    : null;

  if (!mailboxPassword) {
    await failMigration(migrationId, "target_credentials_missing");
    return;
  }

  let source = decodeSourceCredentials(
    migration.sourceCredentialsEnc,
    migration.oauthRefreshTokenEnc
  );

  if (!source) {
    await failMigration(migrationId, "source_credentials_missing");
    return;
  }

  source = await refreshOAuthIfNeeded(source, migration.oauthRefreshTokenEnc);
  if (!source) {
    await failMigration(migrationId, "oauth_refresh_failed");
    return;
  }

  const weights = computeWeights(
    migration.scopeMail,
    migration.scopeContacts,
    migration.scopeCalendar
  );

  const firstPhase: MigrationPhase = migration.scopeMail
    ? "SYNCING_MAIL"
    : migration.scopeContacts
      ? "SYNCING_CONTACTS"
      : "SYNCING_CALENDAR";

  await markMigrationRunning(migrationId, firstPhase);

  let basePercent = 0;
  let currentProgress: MigrationProgress = { percent: 0 };

  if (migration.scopeMail) {
    const targetHost = process.env.MIGRATION_STALWART_IMAP_HOST ?? resolveStalwartImapHost();
    const targetPort = Number(process.env.MIGRATION_STALWART_IMAP_PORT ?? "993");
    const sourceStats = parseSourceStatsJson(migration.sourceStatsJson);
    const totalMessages = sourceStats?.mail.messageCount;

    const result = await runImapsync({
      source,
      targetHost,
      targetPort,
      targetUser: migration.mailbox.address,
      targetPassword: mailboxPassword,
      totalMessages,
      onProgress: (progress, line) => {
        const scaled: MigrationProgress = {
          ...progress,
          percent: Math.round((progress.percent / 100) * weights.mail),
        };
        currentProgress = scaled;
        void updateMigrationProgress(migrationId, scaled, "SYNCING_MAIL");
        const trimmed = line.trim();
        if (trimmed && shouldLogImapsyncLine(trimmed)) {
          void logMigrationEvent(
            migrationId,
            redactImapsyncLogLine(trimmed).slice(0, 500),
            "SYNCING_MAIL"
          );
        }
      },
    });

    if (!result.ok) {
      const error =
        result.error === "imapsync_not_found"
          ? "imapsync_not_found"
          : result.error ?? "imapsync_failed";
      await failMigration(migrationId, error);
      return;
    }

    basePercent += weights.mail;
    currentProgress = { ...result.progress, percent: basePercent };
  }

  if (migration.scopeContacts) {
    await updateMigrationProgress(migrationId, { ...currentProgress, percent: basePercent }, "SYNCING_CONTACTS");

    const contactsResult = await runContactsMigration({
      provider: migration.provider,
      sourceCredentialsEnc: migration.sourceCredentialsEnc,
      oauthRefreshTokenEnc: migration.oauthRefreshTokenEnc,
      targetAddress: migration.mailbox.address,
      targetPassword: mailboxPassword,
      basePercent,
      weightPercent: weights.contacts,
      onProgress: (progress) => {
        currentProgress = progress;
        void updateMigrationProgress(migrationId, progress, "SYNCING_CONTACTS");
      },
    });

    if (!contactsResult.ok) {
      await failMigration(migrationId, contactsResult.error ?? "contacts_import_failed");
      return;
    }

    basePercent += weights.contacts;
    currentProgress = contactsResult.progress;
  }

  if (migration.scopeCalendar) {
    await updateMigrationProgress(migrationId, { ...currentProgress, percent: basePercent }, "SYNCING_CALENDAR");

    const calendarResult = await runCalendarMigration({
      provider: migration.provider,
      sourceCredentialsEnc: migration.sourceCredentialsEnc,
      oauthRefreshTokenEnc: migration.oauthRefreshTokenEnc,
      targetAddress: migration.mailbox.address,
      targetPassword: mailboxPassword,
      basePercent,
      weightPercent: weights.calendar,
      onProgress: (progress) => {
        currentProgress = progress;
        void updateMigrationProgress(migrationId, progress, "SYNCING_CALENDAR");
      },
    });

    if (!calendarResult.ok) {
      await failMigration(migrationId, calendarResult.error ?? "calendar_import_failed");
      return;
    }
  }

  await completeMigration(migrationId);
}

export async function pollMailboxMigrations() {
  const concurrency = resolveWorkerConcurrency();
  const queued = await prisma.mailboxMigration.findMany({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: concurrency,
  });

  await Promise.all(queued.map((migration) => processMigration(migration.id)));
}

export function startMigrationPoller() {
  setInterval(() => {
    void pollMailboxMigrations();
  }, POLL_INTERVAL_MS);

  void pollMailboxMigrations();
}
