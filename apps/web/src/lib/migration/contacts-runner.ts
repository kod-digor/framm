import type { MigrationProvider } from "@prisma/client";
import {
  fetchAllGoogleContacts,
} from "@/lib/migration/discovery/google";
import {
  fetchAllMicrosoftContacts,
} from "@/lib/migration/discovery/microsoft";
import { decodeSourceCredentials } from "@/lib/migration/imapsync-runner";
import { resolveOAuthAccessToken } from "@/lib/migration/oauth-access";
import type { ImapSourceCredentials, MigrationProgress } from "@/lib/migration/types";
import {
  googleContactToStalwart,
  importContactsToStalwart,
  microsoftContactToStalwart,
  type StalwartContactInput,
} from "@/lib/migration/stalwart-import";

export type ContactsRunResult = {
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

async function fetchSourceContacts(
  provider: MigrationProvider,
  accessToken: string,
  onProgress?: (synced: number) => void
): Promise<StalwartContactInput[]> {
  if (provider === "GOOGLE") {
    const raw = await fetchAllGoogleContacts(accessToken, onProgress);
    return raw.map(googleContactToStalwart).filter((c): c is StalwartContactInput => c !== null);
  }
  if (provider === "MICROSOFT") {
    const raw = await fetchAllMicrosoftContacts(accessToken, onProgress);
    return raw.map(microsoftContactToStalwart).filter((c): c is StalwartContactInput => c !== null);
  }
  return [];
}

export async function runContactsMigration(params: {
  provider: MigrationProvider;
  sourceCredentialsEnc: string | null;
  oauthRefreshTokenEnc: string | null;
  targetAddress: string;
  targetPassword: string;
  basePercent: number;
  weightPercent: number;
  onProgress?: (progress: MigrationProgress) => void;
}): Promise<ContactsRunResult> {
  const progress: MigrationProgress = {
    percent: params.basePercent,
    contactsSynced: 0,
    contactsTotal: 0,
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
    return { ok: false, error: "contacts_not_supported", progress };
  }

  const contacts = await fetchSourceContacts(
    params.provider,
    accessToken!,
    (synced) => {
      progress.contactsSynced = synced;
      progress.contactsTotal = synced;
      progress.percent = params.basePercent;
      params.onProgress?.({ ...progress });
    }
  );

  progress.contactsTotal = contacts.length;

  if (contacts.length === 0) {
    progress.percent = params.basePercent + params.weightPercent;
    return { ok: true, progress };
  }

  const result = await importContactsToStalwart(
    params.targetAddress,
    params.targetPassword,
    contacts,
    (synced, total) => {
      progress.contactsSynced = synced;
      progress.contactsTotal = total;
      progress.percent =
        params.basePercent +
        Math.round((synced / Math.max(total, 1)) * params.weightPercent);
      params.onProgress?.({ ...progress });
    }
  );

  progress.contactsSynced = result.synced;
  progress.percent = params.basePercent + params.weightPercent;

  if (result.failed > 0 && result.synced === 0) {
    return { ok: false, error: "contacts_import_failed", progress };
  }

  return { ok: true, progress };
}
