import { classifyApiError } from "./api-error";
import { computeCalendarDateRange, eventStartDate } from "./calendar-stats";
import type { MigrationCalendarStats, MigrationContactsStats, MigrationMailStats } from "./types";

const GRAPH = "https://graph.microsoft.com/v1.0";

async function graphGet<T>(accessToken: string, path: string): Promise<T | null> {
  const res = await fetch(`${GRAPH}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export async function discoverMicrosoftMailStats(
  accessToken: string
): Promise<MigrationMailStats> {
  type FolderPage = {
    value?: Array<{ totalItemCount?: number; childFolderCount?: number }>;
    "@odata.nextLink"?: string;
  };

  let messageCount = 0;
  let folderCount = 0;
  let nextUrl: string | null = "/me/mailFolders?$select=totalItemCount,childFolderCount&$top=999";

  while (nextUrl) {
    const res = await fetch(nextUrl.startsWith("http") ? nextUrl : `${GRAPH}${nextUrl}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      return { available: false, unavailableReason: classifyApiError(res.status, "graph_mail_error") };
    }

    const data = (await res.json()) as FolderPage;
    for (const folder of data.value ?? []) {
      folderCount++;
      messageCount += folder.totalItemCount ?? 0;
    }
    nextUrl = data["@odata.nextLink"] ?? null;
  }

  let attachmentCount: number | undefined;
  let attachmentCountIsEstimate = false;

  const attachmentCountRes = await fetch(
    `${GRAPH}/me/messages/$count?$filter=hasAttachments eq true`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ConsistencyLevel: "eventual",
      },
      signal: AbortSignal.timeout(30_000),
    }
  );
  if (attachmentCountRes.ok) {
    const parsed = Number(await attachmentCountRes.text());
    if (Number.isFinite(parsed)) {
      attachmentCount = parsed;
      attachmentCountIsEstimate = true;
    }
  }

  return {
    available: true,
    messageCount,
    folderCount,
    attachmentCount,
    attachmentCountIsEstimate,
  };
}

export async function discoverMicrosoftContactsStats(
  accessToken: string
): Promise<MigrationContactsStats> {
  const countRes = await fetch(`${GRAPH}/me/contacts/$count`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ConsistencyLevel: "eventual",
    },
    signal: AbortSignal.timeout(30_000),
  });
  const contactCount = countRes.ok ? Number(await countRes.text()) || 0 : 0;

  const folders = await graphGet<{ value?: unknown[] }>(
    accessToken,
    "/me/contactFolders?$select=id&$top=999"
  );
  const groupCount = folders?.value?.length ?? 0;

  if (!countRes.ok && !folders) {
    return {
      available: false,
      unavailableReason: classifyApiError(countRes.status, "graph_contacts_error"),
    };
  }

  return { available: true, contactCount, groupCount };
}

export async function discoverMicrosoftCalendarStats(
  accessToken: string
): Promise<MigrationCalendarStats> {
  type EventPage = {
    value?: Array<{
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      type?: string;
      recurrence?: unknown;
    }>;
    "@odata.nextLink"?: string;
  };

  let eventCount = 0;
  let recurringCount = 0;
  const dates: string[] = [];
  let nextUrl: string | null =
    "/me/calendar/events?$select=start,end,type,recurrence&$top=999";

  while (nextUrl) {
    const res = await fetch(nextUrl.startsWith("http") ? nextUrl : `${GRAPH}${nextUrl}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      return { available: false, unavailableReason: classifyApiError(res.status, "graph_calendar_error") };
    }

    const data = (await res.json()) as EventPage;
    for (const ev of data.value ?? []) {
      // Ignorer les occurrences développées (évite dates lointaines et double comptage).
      if (ev.type === "occurrence" || ev.type === "exception") continue;
      eventCount++;
      if (ev.recurrence) recurringCount++;
      const start = eventStartDate(ev);
      if (start) dates.push(start);
    }
    nextUrl = data["@odata.nextLink"] ?? null;
  }

  const range = computeCalendarDateRange(dates);
  return {
    available: true,
    eventCount,
    recurringCount,
    ...range,
  };
}

export type MicrosoftContact = {
  id: string;
  displayName?: string;
  givenName?: string;
  surname?: string;
  emailAddresses?: Array<{ address?: string; name?: string }>;
  mobilePhone?: string;
  businessPhones?: string[];
  companyName?: string;
  jobTitle?: string;
};

export async function fetchAllMicrosoftContacts(
  accessToken: string,
  onProgress?: (synced: number) => void
): Promise<MicrosoftContact[]> {
  const all: MicrosoftContact[] = [];
  let nextUrl: string | null =
    "/me/contacts?$select=id,displayName,givenName,surname,emailAddresses,mobilePhone,businessPhones,companyName,jobTitle&$top=999";

  while (nextUrl) {
    const res = await fetch(nextUrl.startsWith("http") ? nextUrl : `${GRAPH}${nextUrl}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) break;

    const data = (await res.json()) as {
      value?: MicrosoftContact[];
      "@odata.nextLink"?: string;
    };
    all.push(...(data.value ?? []));
    onProgress?.(all.length);
    nextUrl = data["@odata.nextLink"] ?? null;
  }

  return all;
}

export type MicrosoftCalendarEvent = {
  id: string;
  subject?: string;
  body?: { content?: string };
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  location?: { displayName?: string };
  isAllDay?: boolean;
};

export async function fetchAllMicrosoftCalendarEvents(
  accessToken: string,
  onProgress?: (synced: number) => void
): Promise<MicrosoftCalendarEvent[]> {
  const all: MicrosoftCalendarEvent[] = [];
  let nextUrl: string | null =
    "/me/calendar/events?$select=id,subject,body,start,end,location,isAllDay&$top=999";

  while (nextUrl) {
    const res = await fetch(nextUrl.startsWith("http") ? nextUrl : `${GRAPH}${nextUrl}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) break;

    const data = (await res.json()) as {
      value?: MicrosoftCalendarEvent[];
      "@odata.nextLink"?: string;
    };
    all.push(...(data.value ?? []));
    onProgress?.(all.length);
    nextUrl = data["@odata.nextLink"] ?? null;
  }

  return all;
}
