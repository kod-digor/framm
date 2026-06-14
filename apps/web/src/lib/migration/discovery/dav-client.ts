import { computeCalendarDateRange } from "./calendar-stats";

const CARDDAV_PROPFIND = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <D:prop><D:resourcetype/><D:getetag/></D:prop>
</D:propfind>`;

const CALDAV_PROPFIND = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><D:resourcetype/><D:getetag/></D:prop>
</D:propfind>`;

function countDavResources(xml: string): number {
  const hrefMatches = xml.match(/<D:href[^>]*>([^<]+\.vcf[^<]*)<\/D:href>/gi);
  if (hrefMatches) return hrefMatches.length;
  const icsMatches = xml.match(/<D:href[^>]*>([^<]+\.ics[^<]*)<\/D:href>/gi);
  if (icsMatches) return icsMatches.length;
  const etagMatches = xml.match(/<D:getetag>/gi);
  return etagMatches ? Math.max(0, etagMatches.length - 1) : 0;
}

function extractPrincipalHref(xml: string): string | null {
  const match =
    /<(?:D:|)current-user-principal[^>]*>[\s\S]*?<(?:D:|)href[^>]*>([^<]+)<\/(?:D:|)href>/i.exec(
      xml
    );
  return match?.[1] ?? null;
}

function extractAddressbookHome(xml: string): string | null {
  const match =
    /<(?:card:|)addressbook-home-set[^>]*>[\s\S]*?<(?:D:|)href[^>]*>([^<]+)<\/(?:D:|)href>/i.exec(
      xml
    );
  return match?.[1] ?? null;
}

function extractCalendarHome(xml: string): string | null {
  const match =
    /<(?:C:|)calendar-home-set[^>]*>[\s\S]*?<(?:D:|)href[^>]*>([^<]+)<\/(?:D:|)href>/i.exec(
      xml
    );
  return match?.[1] ?? null;
}

function extractCalendarDates(xml: string): string[] {
  const dates: string[] = [];
  const dtstartRe = /<(?:DTSTART|dtstart)[^>]*>([^<]+)<\//gi;
  let m: RegExpExecArray | null;
  while ((m = dtstartRe.exec(xml)) !== null) {
    const raw = m[1].trim();
    const parsed = parseIcalDate(raw);
    if (parsed) dates.push(parsed);
  }
  return dates;
}

function parseIcalDate(raw: string): string | null {
  const cleaned = raw.replace(/^;.*$/, "").trim();
  if (/^\d{8}$/.test(cleaned)) {
    const y = cleaned.slice(0, 4);
    const mo = cleaned.slice(4, 6);
    const d = cleaned.slice(6, 8);
    return `${y}-${mo}-${d}`;
  }
  if (/^\d{8}T\d{6}Z?$/.test(cleaned)) {
    const y = cleaned.slice(0, 4);
    const mo = cleaned.slice(4, 6);
    const d = cleaned.slice(6, 8);
    return `${y}-${mo}-${d}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) return cleaned.slice(0, 10);
  return null;
}

async function davPropfind(
  url: string,
  auth: string,
  body: string,
  depth: "0" | "1"
): Promise<string> {
  const res = await fetch(url, {
    method: "PROPFIND",
    headers: {
      Authorization: `Basic ${auth}`,
      Depth: depth,
      "Content-Type": "application/xml; charset=utf-8",
    },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`DAV ${res.status}`);
  return res.text();
}

async function davReport(url: string, auth: string, body: string): Promise<string> {
  const res = await fetch(url, {
    method: "REPORT",
    headers: {
      Authorization: `Basic ${auth}`,
      Depth: "1",
      "Content-Type": "application/xml; charset=utf-8",
    },
    body,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`DAV report ${res.status}`);
  return res.text();
}

export async function discoverCardDavStats(
  baseUrl: string,
  user: string,
  password: string
): Promise<{ contactCount: number; groupCount: number }> {
  const auth = Buffer.from(`${user}:${password}`).toString("base64");
  const root = baseUrl.replace(/\/$/, "");

  const principalXml = await davPropfind(
    `${root}/`,
    auth,
    `<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:prop><D:current-user-principal/></D:prop></D:propfind>`,
    "0"
  );
  const principalHref = extractPrincipalHref(principalXml);
  const principalUrl = principalHref
    ? new URL(principalHref, `${root}/`).href
    : `${root}/${encodeURIComponent(user.split("@")[0] ?? user)}/`;

  const homeXml = await davPropfind(
    principalUrl,
    auth,
    `<?xml version="1.0"?><D:propfind xmlns:D="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav"><D:prop><card:addressbook-home-set/></D:prop></D:propfind>`,
    "0"
  );
  const homeHref = extractAddressbookHome(homeXml);
  const booksUrl = homeHref
    ? new URL(homeHref, root).href
    : `${root}/${encodeURIComponent(user.split("@")[0] ?? user)}/card/`;

  const booksXml = await davPropfind(booksUrl, auth, CARDDAV_PROPFIND, "1");
  const bookHrefs = [...booksXml.matchAll(/<D:href[^>]*>([^<]+)<\/D:href>/gi)]
    .map((m) => m[1])
    .filter((h) => h.includes("/") && !h.endsWith("/"));

  let contactCount = 0;
  let groupCount = 0;

  for (const href of bookHrefs.slice(0, 20)) {
    const bookUrl = new URL(href, booksUrl).href;
    const contactsXml = await davPropfind(bookUrl, auth, CARDDAV_PROPFIND, "1");
    contactCount += countDavResources(contactsXml);
    if (contactsXml.includes("VCARD") && contactsXml.toLowerCase().includes("kind:group")) {
      groupCount += (contactsXml.match(/kind:group/gi) ?? []).length;
    }
  }

  if (contactCount === 0) {
    contactCount = countDavResources(booksXml);
  }

  return { contactCount, groupCount };
}

export async function discoverCalDavStats(
  baseUrl: string,
  user: string,
  password: string
): Promise<{
  eventCount: number;
  firstEventDate?: string;
  lastEventDate?: string;
  activityFirstEventDate?: string;
  activityLastEventDate?: string;
}> {
  const auth = Buffer.from(`${user}:${password}`).toString("base64");
  const root = baseUrl.replace(/\/$/, "");

  const principalXml = await davPropfind(
    `${root}/`,
    auth,
    `<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:prop><D:current-user-principal/></D:prop></D:propfind>`,
    "0"
  );
  const principalHref = extractPrincipalHref(principalXml);
  const principalUrl = principalHref
    ? new URL(principalHref, `${root}/`).href
    : `${root}/${encodeURIComponent(user.split("@")[0] ?? user)}/`;

  const homeXml = await davPropfind(
    principalUrl,
    auth,
    `<?xml version="1.0"?><D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav"><D:prop><C:calendar-home-set/></D:prop></D:propfind>`,
    "0"
  );
  const homeHref = extractCalendarHome(homeXml);
  const calsUrl = homeHref
    ? new URL(homeHref, root).href
    : `${root}/${encodeURIComponent(user.split("@")[0] ?? user)}/calendars/`;

  const calsXml = await davPropfind(calsUrl, auth, CALDAV_PROPFIND, "1");
  const calHrefs = [...calsXml.matchAll(/<D:href[^>]*>([^<]+)<\/D:href>/gi)]
    .map((m) => m[1])
    .filter((h) => h.includes("/") && !h.endsWith("/"));

  let eventCount = 0;
  const allDates: string[] = [];

  const reportBody = `<?xml version="1.0" encoding="utf-8"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><D:getetag/><C:calendar-data/></D:prop>
  <C:filter><C:comp-filter name="VCALENDAR"><C:comp-filter name="VEVENT"/></C:comp-filter></C:filter>
</C:calendar-query>`;

  for (const href of calHrefs.slice(0, 10)) {
    const calUrl = new URL(href, calsUrl).href;
    const reportXml = await davReport(calUrl, auth, reportBody);
    eventCount += (reportXml.match(/BEGIN:VEVENT/gi) ?? []).length;
    allDates.push(...extractCalendarDates(reportXml));
  }

  const range = computeCalendarDateRange(allDates);
  return {
    eventCount,
    ...range,
  };
}
