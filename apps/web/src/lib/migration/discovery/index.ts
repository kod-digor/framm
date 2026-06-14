import type { MigrationProvider } from "@prisma/client";
import { decodeSourceCredentials } from "@/lib/migration/imapsync-runner";
import { resolveOAuthAccessToken } from "@/lib/migration/oauth-access";
import type { ImapSourceCredentials } from "@/lib/migration/types";
import { discoverCardDavStats, discoverCalDavStats } from "./dav-client";
import {
  discoverGoogleCalendarStats,
  discoverGoogleContactsStats,
  discoverGoogleMailStats,
} from "./google";
import { discoverImapMailStats } from "./imap-client";
import {
  discoverMicrosoftCalendarStats,
  discoverMicrosoftContactsStats,
  discoverMicrosoftMailStats,
} from "./microsoft";
import type { MigrationSourceStats } from "./types";

function imapPassword(source: ImapSourceCredentials): string | null {
  return source.password ?? null;
}

function oauthUnavailable(reason: string): MigrationSourceStats {
  return {
    mail: { available: false, unavailableReason: reason },
    contacts: { available: false, unavailableReason: reason },
    calendar: { available: false, unavailableReason: reason },
    discoveredAt: new Date().toISOString(),
  };
}

export async function discoverMigrationSource(params: {
  provider: MigrationProvider;
  sourceCredentialsEnc: string | null;
  oauthRefreshTokenEnc: string | null;
}): Promise<MigrationSourceStats> {
  const source = decodeSourceCredentials(
    params.sourceCredentialsEnc,
    params.oauthRefreshTokenEnc
  );

  const unavailable = (reason: string): MigrationSourceStats => ({
    mail: { available: false, unavailableReason: reason },
    contacts: { available: false, unavailableReason: reason },
    calendar: { available: false, unavailableReason: reason },
    discoveredAt: new Date().toISOString(),
  });

  if (!source) return unavailable("source_credentials_missing");

  let mail = { available: false, unavailableReason: "unsupported" } as MigrationSourceStats["mail"];
  let contacts = { available: false, unavailableReason: "unsupported" } as MigrationSourceStats["contacts"];
  let calendar = { available: false, unavailableReason: "unsupported" } as MigrationSourceStats["calendar"];

  if (params.provider === "GOOGLE" || params.provider === "MICROSOFT") {
    const oauth = await resolveOAuthAccessToken(source, params.oauthRefreshTokenEnc);
    if (!oauth.accessToken) {
      return oauthUnavailable(oauth.error ?? "oauth_token_missing");
    }

    const accessToken = oauth.accessToken;
    if (params.provider === "GOOGLE") {
      mail = await discoverGoogleMailStats(accessToken);
      contacts = await discoverGoogleContactsStats(accessToken);
      calendar = await discoverGoogleCalendarStats(accessToken);
    } else {
      mail = await discoverMicrosoftMailStats(accessToken);
      contacts = await discoverMicrosoftContactsStats(accessToken);
      calendar = await discoverMicrosoftCalendarStats(accessToken);
    }
  } else if (params.provider === "ICLOUD" || params.provider === "IMAP_GENERIC") {
    const password = imapPassword(source);
    if (!password) return unavailable("source_credentials_missing");

    try {
      const imapStats = await discoverImapMailStats({
        host: source.host,
        port: source.port,
        user: source.user,
        password,
      });
      mail = {
        available: true,
        messageCount: imapStats.messageCount,
        folderCount: imapStats.folderCount,
      };
    } catch {
      mail = { available: false, unavailableReason: "imap_error" };
    }

    if (params.provider === "ICLOUD") {
      try {
        const cardStats = await discoverCardDavStats(
          "https://contacts.icloud.com",
          source.user,
          password
        );
        contacts = {
          available: true,
          contactCount: cardStats.contactCount,
          groupCount: cardStats.groupCount,
        };
      } catch {
        contacts = { available: false, unavailableReason: "carddav_error" };
      }

      try {
        const calStats = await discoverCalDavStats(
          "https://caldav.icloud.com",
          source.user,
          password
        );
        calendar = {
          available: true,
          eventCount: calStats.eventCount,
          firstEventDate: calStats.firstEventDate,
          lastEventDate: calStats.lastEventDate,
          activityFirstEventDate: calStats.activityFirstEventDate,
          activityLastEventDate: calStats.activityLastEventDate,
        };
      } catch {
        calendar = { available: false, unavailableReason: "caldav_error" };
      }
    } else {
      contacts = { available: false, unavailableReason: "imap_no_contacts" };
      calendar = { available: false, unavailableReason: "imap_no_calendar" };
    }
  }

  return {
    mail,
    contacts,
    calendar,
    discoveredAt: new Date().toISOString(),
  };
}
