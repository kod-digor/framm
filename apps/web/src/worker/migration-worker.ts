import { prisma } from "@/lib/prisma";
import { unsealSecret } from "@/lib/crypto/seal";
import {
  decodeSourceCredentials,
  runImapsync,
} from "@/lib/migration/imapsync-runner";
import {
  completeMigration,
  failMigration,
  logMigrationEvent,
  markMigrationRunning,
  updateMigrationProgress,
} from "@/lib/migration/orchestrator";
import { refreshGoogleAccessToken } from "@/lib/migration/providers/google";
import { refreshMicrosoftAccessToken } from "@/lib/migration/providers/microsoft";
import type { ImapSourceCredentials } from "@/lib/migration/types";

const POLL_INTERVAL_MS = 15_000;

function resolveStalwartImapHost(): string {
  const url = process.env.STALWART_URL ?? process.env.WEBMAIL_URL ?? "";
  try {
    if (url) return new URL(url).hostname;
  } catch {
    // ignore
  }
  return "localhost";
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

  if (!migration.scopeMail) {
    await failMigration(migrationId, "mail_scope_disabled");
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

  await markMigrationRunning(migrationId);

  const targetHost = process.env.MIGRATION_STALWART_IMAP_HOST ?? resolveStalwartImapHost();
  const targetPort = Number(process.env.MIGRATION_STALWART_IMAP_PORT ?? "993");

  const result = await runImapsync({
    source,
    targetHost,
    targetPort,
    targetUser: migration.mailbox.address,
    targetPassword: mailboxPassword,
    onProgress: (progress, line) => {
      void updateMigrationProgress(migrationId, progress, "SYNCING_MAIL");
      if (line.trim()) {
        void logMigrationEvent(migrationId, line.trim().slice(0, 500), "SYNCING_MAIL");
      }
    },
  });

  if (result.ok) {
    await completeMigration(migrationId);
  } else {
    const error =
      result.error === "imapsync_not_found"
        ? "imapsync_not_found"
        : result.error ?? "imapsync_failed";
    await failMigration(migrationId, error);
  }
}

export async function pollMailboxMigrations() {
  const queued = await prisma.mailboxMigration.findMany({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: 3,
  });

  for (const migration of queued) {
    await processMigration(migration.id);
  }
}

export function startMigrationPoller() {
  setInterval(() => {
    void pollMailboxMigrations();
  }, POLL_INTERVAL_MS);

  void pollMailboxMigrations();
}
