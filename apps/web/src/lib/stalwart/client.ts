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

export function isStalwartFailure(res: unknown): res is StalwartFailure {
  return (
    typeof res === "object" &&
    res !== null &&
    ("unavailable" in res || "error" in res)
  );
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

export async function createAlias(source: string, destination: string) {
  const id = `alias-${Date.now()}`;
  return jmapCall([
    [
      "x:EmailAlias/set",
      {
        create: {
          [id]: {
            email: source,
            redirectTo: [destination],
          },
        },
      },
      "c1",
    ],
  ]);
}

export async function queryEmailAliasByEmail(email: string) {
  return jmapCall([["x:EmailAlias/query", { filter: { email } }, "q1"]]);
}

export async function updateAlias(stalwartAliasId: string, destination: string) {
  return jmapCall([
    [
      "x:EmailAlias/set",
      {
        update: {
          [stalwartAliasId]: {
            redirectTo: [destination],
          },
        },
      },
      "u1",
    ],
  ]);
}

export async function deleteAlias(stalwartAliasId: string) {
  return jmapCall([
    [
      "x:EmailAlias/set",
      {
        destroy: [stalwartAliasId],
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

  const queryRes = await queryEmailAliasByEmail(source);
  if (isStalwartFailure(queryRes)) return { id: null, unavailable: true };

  const ids = extractJmapQueryIds(queryRes);
  return { id: ids[0] ?? null, unavailable: false };
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
