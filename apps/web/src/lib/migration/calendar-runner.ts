import type { MigrationProvider } from "@prisma/client";
import { fetchAllGoogleCalendarEvents } from "@/lib/migration/discovery/google";
import { fetchAllMicrosoftCalendarEvents } from "@/lib/migration/discovery/microsoft";
import { decodeSourceCredentials } from "@/lib/migration/imapsync-runner";
import { resolveOAuthAccessToken } from "@/lib/migration/oauth-access";
import type { ImapSourceCredentials, MigrationProgress } from "@/lib/migration/types";
import {
  googleEventToStalwart,
  importCalendarEventsToStalwart,
  microsoftEventToStalwart,
  type StalwartEventInput,
} from "@/lib/migration/stalwart-import";

export type CalendarRunResult = {
  ok: boolean;
  error?: string;
  progress: MigrationProgress;
};

async function resolveAccessToken(
  source: ImapSourceCredentials,
  oauthRefreshTokenEnc: string | null
): Promise<string | null> {
  const oauth = await resolveOAuthAccessToken(source, oauthRefreshTokenEnc);
  return oauth.accessToken;
}

async function fetchSourceEvents(
  provider: MigrationProvider,
  accessToken: string,
  onProgress?: (synced: number) => void
): Promise<StalwartEventInput[]> {
  if (provider === "GOOGLE") {
    const raw = await fetchAllGoogleCalendarEvents(accessToken, onProgress);
    return raw.map(googleEventToStalwart).filter((e): e is StalwartEventInput => e !== null);
  }
  if (provider === "MICROSOFT") {
    const raw = await fetchAllMicrosoftCalendarEvents(accessToken, onProgress);
    return raw.map(microsoftEventToStalwart).filter((e): e is StalwartEventInput => e !== null);
  }
  return [];
}

export async function runCalendarMigration(params: {
  provider: MigrationProvider;
  sourceCredentialsEnc: string | null;
  oauthRefreshTokenEnc: string | null;
  targetAddress: string;
  targetPassword: string;
  basePercent: number;
  weightPercent: number;
  onProgress?: (progress: MigrationProgress) => void;
}): Promise<CalendarRunResult> {
  const progress: MigrationProgress = {
    percent: params.basePercent,
    calendarSynced: 0,
    calendarTotal: 0,
  };

  const source = decodeSourceCredentials(
    params.sourceCredentialsEnc,
    params.oauthRefreshTokenEnc
  );
  if (!source) {
    return { ok: false, error: "source_credentials_missing", progress };
  }

  const accessToken = await resolveAccessToken(source, params.oauthRefreshTokenEnc);
  if (!accessToken && params.provider !== "ICLOUD") {
    return { ok: false, error: "oauth_refresh_failed", progress };
  }

  if (params.provider === "ICLOUD" || params.provider === "IMAP_GENERIC") {
    return { ok: false, error: "calendar_not_supported", progress };
  }

  const events = await fetchSourceEvents(
    params.provider,
    accessToken!,
    (synced) => {
      progress.calendarSynced = synced;
      progress.calendarTotal = synced;
      params.onProgress?.({ ...progress });
    }
  );

  progress.calendarTotal = events.length;

  if (events.length === 0) {
    progress.percent = params.basePercent + params.weightPercent;
    return { ok: true, progress };
  }

  const result = await importCalendarEventsToStalwart(
    params.targetAddress,
    params.targetPassword,
    events,
    (synced, total) => {
      progress.calendarSynced = synced;
      progress.calendarTotal = total;
      progress.percent =
        params.basePercent +
        Math.round((synced / Math.max(total, 1)) * params.weightPercent);
      params.onProgress?.({ ...progress });
    }
  );

  progress.calendarSynced = result.synced;
  progress.percent = params.basePercent + params.weightPercent;

  if (result.failed > 0 && result.synced === 0) {
    return { ok: false, error: "calendar_import_failed", progress };
  }

  return { ok: true, progress };
}
