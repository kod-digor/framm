const STALWART_URL = process.env.STALWART_URL ?? "";
const STALWART_API_KEY = process.env.STALWART_API_KEY ?? "";

type JmapRequest = {
  using: string[];
  methodCalls: [string, Record<string, unknown>, string][];
};

export type StalwartFailure = { unavailable: true } | { error: string };
export type StalwartStatus = "ok" | "unconfigured" | "unreachable";

export type StalwartSetIssue = {
  type: string;
  description?: string;
  properties?: string[];
  objectId?: { object: string; id: string };
};

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

/** Premier échec x:*\/set (notCreated, notUpdated, error JMAP ou indisponibilité). */
export function extractStalwartSetIssue(res: unknown): StalwartSetIssue | null {
  if (typeof res === "object" && res !== null && "unavailable" in res) {
    return { type: "unavailable" };
  }
  if (typeof res === "object" && res !== null && "error" in res) {
    return { type: String((res as { error: string }).error) };
  }

  const first = firstMethodResponse(res);
  if (!first) return null;
  if (first[0] === "error") {
    const err = first[1] as { type?: string };
    return { type: err.type ?? "jmapError" };
  }

  const body = first[1] as {
    notCreated?: Record<string, StalwartSetIssue>;
    notUpdated?: Record<string, StalwartSetIssue>;
  };
  const bucket = body.notCreated ?? body.notUpdated;
  if (!bucket) return null;
  return Object.values(bucket)[0] ?? null;
}

/** Compte Stalwart orphelin lors d'un primaryKeyViolation (Account uniquement, pas MailingList). */
export function extractStalwartOrphanAccountId(
  issue: StalwartSetIssue | null
): string | undefined {
  if (issue?.type !== "primaryKeyViolation") return undefined;
  if (issue.objectId?.object !== "Account") return undefined;
  return issue.objectId.id;
}

export function isStalwartAliasConflict(issue: StalwartSetIssue | null): boolean {
  return issue?.type === "primaryKeyViolation" && issue.objectId?.object === "MailingList";
}

/** Mot de passe refusé par Stalwart (règles de robustesse, pas seulement la longueur). */
export function isStalwartPasswordIssue(issue: StalwartSetIssue | null): boolean {
  return (
    issue?.type === "invalidProperties" &&
    (issue.properties?.includes("secret") ?? false)
  );
}

export function isStalwartDomainIssue(issue: StalwartSetIssue | null): boolean {
  return issue?.type === "invalidForeignKey" && issue.objectId?.object === "Domain";
}

export function isStalwartTransportIssue(issue: StalwartSetIssue | null): boolean {
  if (!issue) return false;
  return (
    issue.type === "unavailable" ||
    issue.type.startsWith("Stalwart ") ||
    issue.type === "jmapError"
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

const STALWART_DEFAULT_LOCALE = "fr_FR";
const STALWART_DEFAULT_TIMEZONE = "Europe/Paris";
const STALWART_ENCRYPTION_PUBLIC_KEY_ID = process.env.STALWART_ENCRYPTION_PUBLIC_KEY_ID ?? "";
const STALWART_PLATFORM_PGP_PUBLIC_KEY = process.env.STALWART_PLATFORM_PGP_PUBLIC_KEY ?? "";

function defaultEncryptionAtRest():
  | { "@type": "Disabled" }
  | {
      "@type": "Aes256";
      publicKey: string;
      encryptOnAppend: false;
      allowSpamTraining: false;
    } {
  if (STALWART_ENCRYPTION_PUBLIC_KEY_ID) {
    return {
      "@type": "Aes256",
      publicKey: STALWART_ENCRYPTION_PUBLIC_KEY_ID,
      encryptOnAppend: false,
      allowSpamTraining: false,
    };
  }
  return { "@type": "Disabled" };
}

function accountUserDefaults(displayName?: string | null) {
  const description = displayName?.trim() || undefined;
  return {
    locale: STALWART_DEFAULT_LOCALE,
    timeZone: STALWART_DEFAULT_TIMEZONE,
    encryptionAtRest: defaultEncryptionAtRest(),
    ...(description ? { description } : {}),
  };
}

function accountPasswordPatch(password: string) {
  return {
    credentials: {
      "0": {
        "@type": "Password",
        secret: password,
      },
    },
  };
}

async function enableAccountEncryptionAtRest(accountId: string, publicKeyPem: string) {
  const pkClientId = `pk-${Date.now()}`;
  const pkRes = await jmapCall([
    [
      "x:PublicKey/set",
      {
        accountId,
        create: {
          [pkClientId]: {
            description: "framm-platform",
            emailAddresses: {},
            key: publicKeyPem,
          },
        },
      },
      "pk1",
    ],
  ]);
  if (isStalwartFailure(pkRes)) return pkRes;

  const publicKeyId = extractStalwartCreatedId(pkRes);
  if (!publicKeyId) {
    return { error: "Stalwart PublicKey created without id" as const };
  }

  return jmapCall([
    [
      "x:Account/set",
      {
        update: {
          [accountId]: {
            encryptionAtRest: {
              "@type": "Aes256",
              publicKey: publicKeyId,
              encryptOnAppend: false,
              allowSpamTraining: false,
            },
          },
        },
      },
      "u1",
    ],
  ]);
}

export async function createAccount(
  localPart: string,
  domainId: string,
  password: string,
  displayName?: string | null
) {
  const id = `account-${Date.now()}`;
  const res = await jmapCall([
    [
      "x:Account/set",
      {
        create: {
          [id]: {
            "@type": "User",
            name: localPart,
            domainId,
            ...accountPasswordPatch(password),
            ...accountUserDefaults(displayName),
            roles: { "@type": "User" },
            permissions: { "@type": "Inherit" },
            aliases: {},
            quotas: {},
          },
        },
      },
      "c1",
    ],
  ]);

  if (
    isStalwartFailure(res) ||
    !STALWART_PLATFORM_PGP_PUBLIC_KEY ||
    STALWART_ENCRYPTION_PUBLIC_KEY_ID
  ) {
    return res;
  }

  const accountId = extractStalwartCreatedId(res);
  if (!accountId) return res;

  const encRes = await enableAccountEncryptionAtRest(
    accountId,
    STALWART_PLATFORM_PGP_PUBLIC_KEY
  );
  if (isStalwartFailure(encRes)) return encRes;

  return res;
}

export async function updateAccount(
  stalwartAccountId: string,
  patch: { description?: string | null; password?: string }
) {
  const update: Record<string, unknown> = {};
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.password !== undefined) Object.assign(update, accountPasswordPatch(patch.password));

  return jmapCall([
    [
      "x:Account/set",
      {
        update: {
          [stalwartAccountId]: update,
        },
      },
      "u1",
    ],
  ]);
}

export async function updateAccountPassword(stalwartAccountId: string, password: string) {
  return updateAccount(stalwartAccountId, { password });
}

export async function deleteAccount(stalwartAccountId: string) {
  return jmapCall([
    [
      "x:Account/set",
      {
        destroy: [stalwartAccountId],
      },
      "d1",
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

export async function queryAccountByEmail(email: string) {
  const localPart = parseEmailLocalPart(email);
  return jmapCall([["x:Account/query", { filter: { text: localPart } }, "q1"]]);
}

function extractAccountRecords(res: unknown): { id: string; emailAddress?: string }[] {
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

export async function resolveStalwartAccountId(
  stalwartAccountId: string | null,
  address: string
): Promise<{ id: string | null; unavailable: boolean }> {
  if (stalwartAccountId) return { id: stalwartAccountId, unavailable: false };

  const queryRes = await queryAccountByEmail(address);
  if (isStalwartFailure(queryRes)) return { id: null, unavailable: true };

  const ids = extractJmapQueryIds(queryRes);
  if (ids.length === 0) return { id: null, unavailable: false };
  if (ids.length === 1) return { id: ids[0], unavailable: false };

  const getRes = await jmapCall([["x:Account/get", { ids }, "g1"]]);
  if (isStalwartFailure(getRes)) return { id: null, unavailable: true };

  const match = extractAccountRecords(getRes).find((account) => account.emailAddress === address);
  return { id: match?.id ?? null, unavailable: false };
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

/** URL webmail externe (nouvel onglet). */
export function getWebmailExternalUrl(): string {
  return (process.env.WEBMAIL_URL || STALWART_URL).replace(/\/$/, "");
}
