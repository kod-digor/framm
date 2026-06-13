const STALWART_URL = process.env.STALWART_URL ?? "";
const STALWART_API_KEY = process.env.STALWART_API_KEY ?? "";

type JmapRequest = {
  using: string[];
  methodCalls: [string, Record<string, unknown>, string][];
};

export type StalwartFailure = { unavailable: true } | { error: string };
export type StalwartStatus = "ok" | "unconfigured" | "unreachable";

function stalwartJmapUrl() {
  const base = (process.env.WEBMAIL_URL || STALWART_URL).replace(/\/$/, "");
  return `${base}/jmap`;
}

function firstMethodResponse(res: unknown): unknown[] | null {
  if (!res || typeof res !== "object" || !("methodResponses" in res)) return null;
  const responses = (res as { methodResponses: unknown[][] }).methodResponses;
  return responses?.[0] ?? null;
}

export function isStalwartFailure(res: unknown): res is StalwartFailure {
  if (typeof res === "object" && res !== null && ("unavailable" in res || "error" in res)) {
    return true;
  }

  const first = firstMethodResponse(res);
  if (!first) return false;
  if (first[0] === "error") return true;

  const body = first[1];
  if (!body || typeof body !== "object") return false;

  const patch = body as {
    notCreated?: Record<string, unknown>;
    notUpdated?: Record<string, unknown>;
    notDestroyed?: unknown[];
  };

  if (patch.notCreated && Object.keys(patch.notCreated).length > 0) return true;
  if (patch.notUpdated && Object.keys(patch.notUpdated).length > 0) return true;
  if (patch.notDestroyed && patch.notDestroyed.length > 0) return true;

  return false;
}

export async function getStalwartStatus(): Promise<StalwartStatus> {
  if (!STALWART_API_KEY || !(process.env.WEBMAIL_URL || STALWART_URL)) {
    return "unconfigured";
  }

  const result = await jmapCall([["x:Domain/query", { filter: {} }, "ping"]], 3_000);
  return isStalwartFailure(result) ? "unreachable" : "ok";
}

async function jmapCall(
  methodCalls: JmapRequest["methodCalls"],
  timeoutMs = 15_000
) {
  if (!STALWART_API_KEY) {
    return { unavailable: true as const };
  }

  const body: JmapRequest = {
    using: ["urn:ietf:params:jmap:core", "urn:stalwart:jmap"],
    methodCalls,
  };

  try {
    const res = await fetch(stalwartJmapUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${STALWART_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      return { error: `Stalwart JMAP error: ${res.status}` as const };
    }

    return res.json();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { error: `Stalwart unreachable: ${detail}` as const };
  }
}

export async function deleteDomain(stalwartDomainId: string) {
  return jmapCall([
    [
      "x:Domain/set",
      {
        destroy: [stalwartDomainId],
      },
      "d1",
    ],
  ]);
}

export async function createDomain(fqdn: string) {
  const id = `domain-${Date.now()}`;
  return jmapCall([
    [
      "x:Domain/set",
      {
        create: {
          [id]: {
            name: fqdn,
          },
        },
      },
      "c1",
    ],
  ]);
}

export async function createAccount(email: string, domainId: string, password: string) {
  const id = `account-${Date.now()}`;
  return jmapCall([
    [
      "x:Account/set",
      {
        create: {
          [id]: {
            "@type": "User",
            name: email,
            domainId,
            secrets: [{ type: "password", value: password }],
          },
        },
      },
      "c1",
    ],
  ]);
}

export function extractStalwartCreatedId(res: unknown): string | null {
  if (!res || typeof res !== "object" || !("methodResponses" in res)) return null;
  const created = (res as { methodResponses: unknown[][] }).methodResponses?.[0]?.[1] as
    | { created?: Record<string, { id?: string }> }
    | undefined;
  const first = created?.created && Object.values(created.created)[0];
  return first?.id ?? null;
}

export function extractJmapQueryIds(res: unknown): string[] {
  if (!res || typeof res !== "object" || !("methodResponses" in res)) return [];
  const body = (res as { methodResponses: unknown[][] }).methodResponses?.[0]?.[1];
  if (!body || typeof body !== "object" || !("ids" in body)) return [];
  const ids = (body as { ids: unknown }).ids;
  return Array.isArray(ids) ? (ids as string[]) : [];
}

function recipientsMap(destination: string): Record<string, boolean> {
  return { [destination]: true };
}

function parseEmailLocalPart(email: string): string {
  return email.split("@")[0] ?? email;
}

function extractMailingListRecords(res: unknown): { id: string; emailAddress?: string }[] {
  if (!res || typeof res !== "object" || !("methodResponses" in res)) return [];
  const body = (res as { methodResponses: unknown[][] }).methodResponses?.[0]?.[1];
  if (!body || typeof body !== "object" || !("list" in body)) return [];
  const list = (body as { list: unknown }).list;
  if (!Array.isArray(list)) return [];
  return list.filter(
    (item): item is { id: string; emailAddress?: string } =>
      typeof item === "object" && item !== null && "id" in item
  );
}

export async function resolveStalwartDomainId(
  fqdn: string,
  cachedId?: string | null
): Promise<{ id: string | null; unavailable: boolean }> {
  if (cachedId) return { id: cachedId, unavailable: false };

  const queryRes = await jmapCall([["x:Domain/query", { filter: { text: fqdn } }, "q1"]]);
  if (isStalwartFailure(queryRes)) return { id: null, unavailable: true };

  const ids = extractJmapQueryIds(queryRes);
  return { id: ids[0] ?? null, unavailable: false };
}

/** Redirection email → Stalwart MailingList (destinataire externe). */
export async function createAlias(
  source: string,
  destination: string,
  stalwartDomainId: string
) {
  const id = `ml-${Date.now()}`;
  return jmapCall([
    [
      "x:MailingList/set",
      {
        create: {
          [id]: {
            name: parseEmailLocalPart(source),
            domainId: stalwartDomainId,
            recipients: recipientsMap(destination),
          },
        },
      },
      "c1",
    ],
  ]);
}

export async function queryMailingListByEmail(email: string) {
  const localPart = parseEmailLocalPart(email);
  return jmapCall([["x:MailingList/query", { filter: { text: localPart } }, "q1"]]);
}

export async function updateAlias(
  stalwartListId: string,
  destination: string,
  previousDestination?: string
) {
  const patch: Record<string, unknown> = {
    [`recipients/${destination}`]: true,
  };
  if (previousDestination && previousDestination !== destination) {
    patch[`recipients/${previousDestination}`] = null;
  }

  return jmapCall([
    [
      "x:MailingList/set",
      {
        update: {
          [stalwartListId]: patch,
        },
      },
      "u1",
    ],
  ]);
}

export async function deleteAlias(stalwartListId: string) {
  return jmapCall([
    [
      "x:MailingList/set",
      {
        destroy: [stalwartListId],
      },
      "d1",
    ],
  ]);
}

export async function resolveEmailAliasStalwartId(
  stalwartAliasId: string | null,
  source: string
): Promise<{ id: string | null; unavailable: boolean }> {
  if (stalwartAliasId) return { id: stalwartAliasId, unavailable: false };

  const queryRes = await queryMailingListByEmail(source);
  if (isStalwartFailure(queryRes)) return { id: null, unavailable: true };

  const ids = extractJmapQueryIds(queryRes);
  if (ids.length === 0) return { id: null, unavailable: false };
  if (ids.length === 1) return { id: ids[0], unavailable: false };

  const getRes = await jmapCall([["x:MailingList/get", { ids }, "g1"]]);
  if (isStalwartFailure(getRes)) return { id: null, unavailable: true };

  const match = extractMailingListRecords(getRes).find(
    (list) => list.emailAddress === source
  );
  return { id: match?.id ?? null, unavailable: false };
}

export async function listAccounts() {
  return jmapCall([["x:Account/query", { filter: {} }, "q1"]]);
}

export function getMailConfig() {
  const base = process.env.WEBMAIL_URL || STALWART_URL;
  const host = base.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return {
    imapServer: host,
    smtpServer: host,
    imapPort: 993,
    smtpPort: 587,
    smtpPortSsl: 465,
    webmailUrl: process.env.WEBMAIL_URL ?? "",
  };
}
