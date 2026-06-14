import { classifyApiError, classifyGoogleApiError } from "./api-error";
import { computeCalendarDateRange, eventStartDate } from "./calendar-stats";
import type { MigrationCalendarStats, MigrationContactsStats, MigrationMailStats } from "./types";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

async function readGoogleJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function listGoogleCalendarIds(
  accessToken: string
): Promise<{ ok: true; ids: string[] } | { ok: false; reason: string }> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${CALENDAR_API}/users/me/calendarList`);
    url.searchParams.set("maxResults", "250");
    url.searchParams.set("fields", "items(id),nextPageToken");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const body = await readGoogleJson(res);
      return {
        ok: false,
        reason: classifyGoogleApiError(
          res.status,
          body,
          "calendar_api_error",
          "calendar_api_disabled"
        ),
      };
    }

    const data = (await res.json()) as {
      items?: Array<{ id?: string }>;
      nextPageToken?: string;
    };
    for (const item of data.items ?? []) {
      if (item.id) ids.push(item.id);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return { ok: true, ids: ids.length > 0 ? ids : ["primary"] };
}

export async function discoverGoogleMailStats(
  accessToken: string
): Promise<MigrationMailStats> {
  const profileRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(30_000) }
  );
  if (!profileRes.ok) {
    return { available: false, unavailableReason: classifyApiError(profileRes.status, "gmail_api_error") };
  }
  const profile = (await profileRes.json()) as { messagesTotal?: number };

  const labelsRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/labels",
    { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(30_000) }
  );
  if (!labelsRes.ok) {
    return { available: false, unavailableReason: classifyApiError(labelsRes.status, "gmail_api_error") };
  }
  const labels = (await labelsRes.json()) as { labels?: unknown[] };

  let attachmentCount: number | undefined;
  let attachmentCountIsEstimate = false;

  const attachmentUrl = new URL(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages"
  );
  attachmentUrl.searchParams.set("q", "has:attachment");
  attachmentUrl.searchParams.set("maxResults", "1");

  const attachmentRes = await fetch(attachmentUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (attachmentRes.ok) {
    const attachmentData = (await attachmentRes.json()) as {
      resultSizeEstimate?: number;
    };
    if (typeof attachmentData.resultSizeEstimate === "number") {
      attachmentCount = attachmentData.resultSizeEstimate;
      attachmentCountIsEstimate = true;
    }
  }

  return {
    available: true,
    messageCount: profile.messagesTotal ?? 0,
    folderCount: labels.labels?.length ?? 0,
    attachmentCount,
    attachmentCountIsEstimate,
  };
}

export async function discoverGoogleContactsStats(
  accessToken: string
): Promise<MigrationContactsStats> {
  let contactCount = 0;
  let pageToken: string | undefined;

  do {
    const url = new URL("https://people.googleapis.com/v1/people/me/connections");
    url.searchParams.set("personFields", "names");
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      return { available: false, unavailableReason: classifyApiError(res.status, "people_api_error") };
    }

    const data = (await res.json()) as {
      connections?: unknown[];
      nextPageToken?: string;
      totalItems?: number;
    };
    contactCount += data.connections?.length ?? 0;
    if (typeof data.totalItems === "number" && !pageToken) {
      contactCount = data.totalItems;
      break;
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  const groupsRes = await fetch(
    "https://people.googleapis.com/v1/contactGroups?pageSize=1000",
    { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(30_000) }
  );
  let groupCount = 0;
  if (groupsRes.ok) {
    const groups = (await groupsRes.json()) as { contactGroups?: unknown[]; totalItems?: number };
    groupCount = groups.totalItems ?? groups.contactGroups?.length ?? 0;
  }

  return { available: true, contactCount, groupCount };
}

export async function discoverGoogleCalendarStats(
  accessToken: string
): Promise<MigrationCalendarStats> {
  const calendars = await listGoogleCalendarIds(accessToken);
  if (!calendars.ok) {
    return { available: false, unavailableReason: calendars.reason };
  }

  let eventCount = 0;
  let recurringCount = 0;
  const dates: string[] = [];

  for (const calendarId of calendars.ids) {
    let pageToken: string | undefined;

    do {
      const url = new URL(
        `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`
      );
      // Séries uniquement : évite de compter chaque occurrence et les dates lointaines (ex. 2099).
      url.searchParams.set("singleEvents", "false");
      url.searchParams.set("maxResults", "250");
      url.searchParams.set("fields", "items(start,recurrence,status),nextPageToken");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) {
        const body = await readGoogleJson(res);
        if (res.status === 404 || res.status === 410) break;
        return {
          available: false,
          unavailableReason: classifyGoogleApiError(
            res.status,
            body,
            "calendar_api_error",
            "calendar_api_disabled"
          ),
        };
      }

      const data = (await res.json()) as {
        items?: Array<{
          start?: { date?: string; dateTime?: string };
          recurrence?: string[];
          status?: string;
        }>;
        nextPageToken?: string;
      };

      for (const item of data.items ?? []) {
        if (item.status === "cancelled") continue;
        eventCount++;
        if (item.recurrence?.length) recurringCount++;
        const start = eventStartDate(item);
        if (start) dates.push(start);
      }
      pageToken = data.nextPageToken;
    } while (pageToken && eventCount < 50_000);
  }

  const range = computeCalendarDateRange(dates);
  return {
    available: true,
    eventCount,
    recurringCount,
    ...range,
  };
}

export type GoogleContact = {
  resourceName: string;
  names?: Array<{ displayName?: string; givenName?: string; familyName?: string }>;
  emailAddresses?: Array<{ value?: string; type?: string }>;
  phoneNumbers?: Array<{ value?: string; type?: string }>;
  organizations?: Array<{ name?: string; title?: string }>;
};

export async function fetchAllGoogleContacts(
  accessToken: string,
  onProgress?: (synced: number) => void
): Promise<GoogleContact[]> {
  const all: GoogleContact[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL("https://people.googleapis.com/v1/people/me/connections");
    url.searchParams.set(
      "personFields",
      "names,emailAddresses,phoneNumbers,organizations"
    );
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) break;

    const data = (await res.json()) as {
      connections?: GoogleContact[];
      nextPageToken?: string;
    };
    all.push(...(data.connections ?? []));
    onProgress?.(all.length);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return all;
}

export type GoogleCalendarEvent = {
  id: string;
  summary?: string;
  description?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  status?: string;
  location?: string;
};

export async function fetchAllGoogleCalendarEvents(
  accessToken: string,
  onProgress?: (synced: number) => void
): Promise<GoogleCalendarEvent[]> {
  const calendars = await listGoogleCalendarIds(accessToken);
  if (!calendars.ok) return [];

  const all: GoogleCalendarEvent[] = [];

  for (const calendarId of calendars.ids) {
    let pageToken: string | undefined;

    do {
      const url = new URL(
        `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`
      );
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("maxResults", "250");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) {
        if (res.status === 404 || res.status === 410) break;
        return all;
      }

      const data = (await res.json()) as {
        items?: GoogleCalendarEvent[];
        nextPageToken?: string;
      };
      all.push(...(data.items ?? []));
      onProgress?.(all.length);
      pageToken = data.nextPageToken;
    } while (pageToken);
  }

  return all;
}
