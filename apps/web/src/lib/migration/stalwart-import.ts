import { getStalwartJmapUrl } from "@/lib/stalwart/client";
import { obtainWebmailTokens } from "@/lib/stalwart/webmail-auth";
import type { WebmailTokens } from "@/lib/stalwart/webmail-auth";
import type { JmapRequestBody, JmapResponseBody, JmapSession } from "@/lib/mail/jmap-types";

const CONTACTS_USING = [
  "urn:ietf:params:jmap:core",
  "urn:ietf:params:jmap:contacts",
] as const;

const CALENDARS_USING = [
  "urn:ietf:params:jmap:core",
  "urn:ietf:params:jmap:calendars",
] as const;

async function fetchWithBearer(
  url: string,
  tokens: WebmailTokens,
  init?: RequestInit
): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${tokens.accessToken}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(60_000),
  });
}

async function fetchJmapSession(tokens: WebmailTokens): Promise<JmapSession> {
  const base = getStalwartJmapUrl();
  if (!base) throw new Error("unconfigured");

  const res = await fetchWithBearer(`${base}/.well-known/jmap`, tokens, { method: "GET" });
  if (!res.ok) throw new Error(`jmap_session_${res.status}`);
  return (await res.json()) as JmapSession;
}

async function jmapCall(
  tokens: WebmailTokens,
  body: JmapRequestBody
): Promise<JmapResponseBody> {
  const base = getStalwartJmapUrl();
  if (!base) throw new Error("unconfigured");

  const res = await fetchWithBearer(`${base}/jmap`, tokens, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`jmap_call_${res.status}`);
  return (await res.json()) as JmapResponseBody;
}

function resolveAccountId(session: JmapSession, capability: string): string {
  const account = session.primaryAccounts?.[capability];
  const fallback = session.accounts ? Object.keys(session.accounts)[0] : undefined;
  const accountId = account ?? fallback;
  if (!accountId) throw new Error(`no_${capability}_account`);
  return accountId;
}

function extractList<T>(res: JmapResponseBody, callId: string): T[] {
  const entry = res.methodResponses.find(([, , id]) => id === callId);
  if (!entry) return [];
  const list = entry[1].list;
  return Array.isArray(list) ? (list as T[]) : [];
}

function extractSetCreated(res: JmapResponseBody, callId: string): number {
  const entry = res.methodResponses.find(([, , id]) => id === callId);
  if (!entry) return 0;
  const created = entry[1].created;
  return created && typeof created === "object" ? Object.keys(created).length : 0;
}

async function getDefaultAddressBookId(
  tokens: WebmailTokens,
  accountId: string
): Promise<string> {
  const res = await jmapCall(tokens, {
    using: [...CONTACTS_USING],
    methodCalls: [
      ["AddressBook/get", { accountId, ids: null }, "ab0"],
    ],
  });
  const books = extractList<{ id: string }>(res, "ab0");
  if (books.length === 0) throw new Error("no_address_book");
  return books[0].id;
}

async function getDefaultCalendarId(
  tokens: WebmailTokens,
  accountId: string
): Promise<string> {
  const res = await jmapCall(tokens, {
    using: [...CALENDARS_USING],
    methodCalls: [
      ["Calendar/get", { accountId, ids: null }, "cal0"],
    ],
  });
  const cals = extractList<{ id: string }>(res, "cal0");
  if (cals.length === 0) throw new Error("no_calendar");
  return cals[0].id;
}

export type StalwartContactInput = {
  uid: string;
  name?: { full?: string; first?: string; last?: string };
  emails?: Array<{ email: string; type?: string }>;
  phones?: Array<{ number: string; type?: string }>;
  organization?: string;
};

export type StalwartEventInput = {
  uid: string;
  title: string;
  description?: string;
  start: string;
  duration: string;
  timeZone?: string | null;
  showWithoutTime: boolean;
  location?: string;
};

export async function importContactsToStalwart(
  targetAddress: string,
  targetPassword: string,
  contacts: StalwartContactInput[],
  onProgress?: (synced: number, total: number) => void
): Promise<{ synced: number; failed: number }> {
  const tokens = await obtainWebmailTokens(targetAddress, targetPassword);
  const session = await fetchJmapSession(tokens);
  const accountId = resolveAccountId(session, "urn:ietf:params:jmap:contacts");
  const addressBookId = await getDefaultAddressBookId(tokens, accountId);

  const BATCH = 50;
  let synced = 0;
  let failed = 0;

  for (let i = 0; i < contacts.length; i += BATCH) {
    const batch = contacts.slice(i, i + BATCH);
    const create: Record<string, Record<string, unknown>> = {};

    for (let j = 0; j < batch.length; j++) {
      const c = batch[j];
      create[`c${i + j}`] = {
        addressBookIds: { [addressBookId]: true },
        uid: c.uid,
        name: c.name ?? { full: c.emails?.[0]?.email ?? "Contact" },
        emails: c.emails?.map((e) => ({ email: e.email, type: e.type ?? "other" })),
        phones: c.phones?.map((p) => ({ number: p.number, type: p.type ?? "other" })),
        organization: c.organization,
      };
    }

    const res = await jmapCall(tokens, {
      using: [...CONTACTS_USING],
      methodCalls: [
        ["ContactCard/set", { accountId, create }, `set${i}`],
      ],
    });

    const created = extractSetCreated(res, `set${i}`);
    synced += created;
    failed += batch.length - created;
    onProgress?.(synced, contacts.length);
  }

  return { synced, failed };
}

export async function importCalendarEventsToStalwart(
  targetAddress: string,
  targetPassword: string,
  events: StalwartEventInput[],
  onProgress?: (synced: number, total: number) => void
): Promise<{ synced: number; failed: number }> {
  const tokens = await obtainWebmailTokens(targetAddress, targetPassword);
  const session = await fetchJmapSession(tokens);
  const accountId = resolveAccountId(session, "urn:ietf:params:jmap:calendars");
  const calendarId = await getDefaultCalendarId(tokens, accountId);

  const BATCH = 50;
  let synced = 0;
  let failed = 0;

  for (let i = 0; i < events.length; i += BATCH) {
    const batch = events.slice(i, i + BATCH);
    const create: Record<string, Record<string, unknown>> = {};

    for (let j = 0; j < batch.length; j++) {
      const e = batch[j];
      create[`e${i + j}`] = {
        calendarIds: { [calendarId]: true },
        uid: e.uid,
        title: e.title,
        description: e.description ?? "",
        descriptionContentType: "text/plain",
        start: e.start,
        duration: e.duration,
        timeZone: e.timeZone ?? null,
        showWithoutTime: e.showWithoutTime,
        status: "confirmed",
        freeBusyStatus: "busy",
        privacy: "private",
        location: e.location,
      };
    }

    const res = await jmapCall(tokens, {
      using: [...CALENDARS_USING],
      methodCalls: [
        ["CalendarEvent/set", { accountId, create }, `set${i}`],
      ],
    });

    const created = extractSetCreated(res, `set${i}`);
    synced += created;
    failed += batch.length - created;
    onProgress?.(synced, events.length);
  }

  return { synced, failed };
}

function isoDuration(start: string, end: string, allDay: boolean): string {
  if (allDay) return "P1D";
  const s = new Date(start);
  const e = new Date(end);
  const diffMs = Math.max(e.getTime() - s.getTime(), 60_000);
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `PT${mins}M`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `PT${hours}H${rem}M` : `PT${hours}H`;
}

export function googleEventToStalwart(
  event: import("@/lib/migration/discovery/google").GoogleCalendarEvent
): StalwartEventInput | null {
  const startRaw = event.start?.dateTime ?? event.start?.date;
  if (!startRaw || !event.id) return null;

  const allDay = Boolean(event.start?.date && !event.start?.dateTime);
  const endRaw = event.end?.dateTime ?? event.end?.date ?? startRaw;

  return {
    uid: `google-${event.id}@migration.framm`,
    title: event.summary ?? "(Sans titre)",
    description: event.description,
    start: allDay ? startRaw : startRaw.replace(/\+.*$/, "").replace(/Z$/, ""),
    duration: isoDuration(startRaw, endRaw, allDay),
    timeZone: event.start?.timeZone ?? null,
    showWithoutTime: allDay,
    location: event.location,
  };
}

export function microsoftEventToStalwart(
  event: import("@/lib/migration/discovery/microsoft").MicrosoftCalendarEvent
): StalwartEventInput | null {
  const startRaw = event.start?.dateTime;
  if (!startRaw || !event.id) return null;

  const endRaw = event.end?.dateTime ?? startRaw;
  const allDay = event.isAllDay ?? false;

  return {
    uid: `microsoft-${event.id}@migration.framm`,
    title: event.subject ?? "(Sans titre)",
    description: event.body?.content,
    start: startRaw.replace(/\+.*$/, "").replace(/Z$/, ""),
    duration: isoDuration(startRaw, endRaw, allDay),
    timeZone: event.start?.timeZone ?? null,
    showWithoutTime: allDay,
    location: event.location?.displayName,
  };
}

export function googleContactToStalwart(
  contact: import("@/lib/migration/discovery/google").GoogleContact
): StalwartContactInput | null {
  if (!contact.resourceName) return null;
  const name = contact.names?.[0];
  return {
    uid: `google-${contact.resourceName.replace(/\//g, "-")}@migration.framm`,
    name: {
      full: name?.displayName,
      first: name?.givenName,
      last: name?.familyName,
    },
    emails: contact.emailAddresses
      ?.filter((e) => e.value)
      .map((e) => ({ email: e.value!, type: e.type ?? "other" })),
    phones: contact.phoneNumbers
      ?.filter((p) => p.value)
      .map((p) => ({ number: p.value!, type: p.type ?? "other" })),
    organization: contact.organizations?.[0]?.name,
  };
}

export function microsoftContactToStalwart(
  contact: import("@/lib/migration/discovery/microsoft").MicrosoftContact
): StalwartContactInput | null {
  if (!contact.id) return null;
  return {
    uid: `microsoft-${contact.id}@migration.framm`,
    name: {
      full: contact.displayName,
      first: contact.givenName,
      last: contact.surname,
    },
    emails: contact.emailAddresses
      ?.filter((e) => e.address)
      .map((e) => ({ email: e.address!, type: "other" })),
    phones: [
      ...(contact.mobilePhone ? [{ number: contact.mobilePhone, type: "mobile" }] : []),
      ...(contact.businessPhones?.map((n) => ({ number: n, type: "work" })) ?? []),
    ],
    organization: contact.companyName,
  };
}
