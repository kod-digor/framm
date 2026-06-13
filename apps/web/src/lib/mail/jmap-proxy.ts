import { getWebmailExternalUrl } from "@/lib/stalwart/client";
import type { WebmailTokens } from "@/lib/stalwart/webmail-auth";
import type { JmapRequestBody, JmapResponseBody, JmapSession } from "@/lib/mail/jmap-types";

const MAIL_USING = [
  "urn:ietf:params:jmap:core",
  "urn:ietf:params:jmap:mail",
  "urn:ietf:params:jmap:submission",
] as const;

function webmailBase(): string | null {
  const base = getWebmailExternalUrl();
  return base || null;
}

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
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
}

/** Découverte session JMAP Stalwart (OAuth utilisateur). */
export async function fetchJmapSession(tokens: WebmailTokens): Promise<JmapSession> {
  const base = webmailBase();
  if (!base) throw new Error("unconfigured");

  const discoveryUrl = `${base}/.well-known/jmap`;
  let response = await fetchWithBearer(discoveryUrl, tokens, { method: "GET" });

  if (response.redirected) {
    const peek = (await response.clone().json().catch(() => null)) as JmapSession | null;
    const hasAccounts = peek && Object.keys(peek.accounts ?? {}).length > 0;
    if (!hasAccounts) {
      response = await fetch(response.url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(30_000),
      });
    }
  }

  if (!response.ok) {
    throw new Error(`jmap_session_${response.status}`);
  }

  return (await response.json()) as JmapSession;
}

export function resolveMailAccountId(session: JmapSession): string {
  const mailAccount = session.primaryAccounts?.["urn:ietf:params:jmap:mail"];
  const fallback = session.accounts ? Object.keys(session.accounts)[0] : undefined;
  const accountId = mailAccount ?? fallback;
  if (!accountId) throw new Error("no_mail_account");
  return accountId;
}

/** Proxy d'un appel JMAP vers l'apiUrl de la session. */
export async function proxyJmapCall(
  tokens: WebmailTokens,
  body: JmapRequestBody
): Promise<JmapResponseBody> {
  const session = await fetchJmapSession(tokens);
  const response = await fetchWithBearer(session.apiUrl, tokens, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`jmap_call_${response.status}`);
  }

  return (await response.json()) as JmapResponseBody;
}

export function inboxQuery(accountId: string, mailboxId: string, limit = 50): JmapRequestBody {
  return {
    using: [...MAIL_USING],
    methodCalls: [
      [
        "Email/query",
        {
          accountId,
          filter: { inMailbox: mailboxId },
          sort: [{ property: "receivedAt", isAscending: false }],
          limit,
        },
        "q0",
      ],
    ],
  };
}

export function mailboxesQuery(accountId: string): JmapRequestBody {
  return {
    using: [...MAIL_USING],
    methodCalls: [["Mailbox/query", { accountId, filter: {} }, "mq0"]],
  };
}

export function mailboxesGet(accountId: string, ids: string[]): JmapRequestBody {
  return {
    using: [...MAIL_USING],
    methodCalls: [
      [
        "Mailbox/get",
        {
          accountId,
          ids,
          properties: ["id", "name", "role", "unreadEmails", "totalEmails"],
        },
        "mg0",
      ],
    ],
  };
}

export function emailsGet(accountId: string, ids: string[]): JmapRequestBody {
  return {
    using: [...MAIL_USING],
    methodCalls: [
      [
        "Email/get",
        {
          accountId,
          ids,
          properties: [
            "id",
            "threadId",
            "subject",
            "from",
            "to",
            "cc",
            "receivedAt",
            "preview",
            "keywords",
            "hasAttachment",
            "textBody",
            "htmlBody",
            "bodyValues",
          ],
          fetchTextBodyValues: true,
          fetchHTMLBodyValues: true,
        },
        "eg0",
      ],
    ],
  };
}

/** Chaîne Mailbox/query → get inbox + Email/query pour la liste. */
export async function fetchInboxEmails(tokens: WebmailTokens, limit = 50) {
  const session = await fetchJmapSession(tokens);
  const accountId = resolveMailAccountId(session);

  const mailboxRes = await proxyJmapCall(tokens, mailboxesQuery(accountId));
  const mailboxIds = extractQueryIds(mailboxRes, "mq0");
  if (mailboxIds.length === 0) {
    return { accountId, mailboxId: null as string | null, emails: [], session };
  }

  const mailboxGetRes = await proxyJmapCall(tokens, mailboxesGet(accountId, mailboxIds));
  const mailboxes = extractList<JmapMailboxLike>(mailboxGetRes, "mg0");
  const inbox =
    mailboxes.find((m) => m.role === "inbox") ??
    mailboxes.find((m) => m.name?.toLowerCase() === "inbox") ??
    mailboxes[0];

  if (!inbox) {
    return { accountId, mailboxId: null, emails: [], session };
  }

  const emailQueryRes = await proxyJmapCall(tokens, inboxQuery(accountId, inbox.id, limit));
  const emailIds = extractQueryIds(emailQueryRes, "q0");
  if (emailIds.length === 0) {
    return { accountId, mailboxId: inbox.id, emails: [], session };
  }

  const emailGetRes = await proxyJmapCall(tokens, emailsGet(accountId, emailIds));
  const emails = extractList<JmapEmailLike>(emailGetRes, "eg0");

  return { accountId, mailboxId: inbox.id, emails, session };
}

type JmapMailboxLike = { id: string; name: string; role?: string | null };
type JmapEmailLike = Record<string, unknown>;

function extractQueryIds(res: JmapResponseBody, callId: string): string[] {
  const entry = res.methodResponses.find(([, , id]) => id === callId);
  if (!entry) return [];
  const ids = entry[1].ids;
  return Array.isArray(ids) ? (ids as string[]) : [];
}

function extractList<T>(res: JmapResponseBody, callId: string): T[] {
  const entry = res.methodResponses.find(([, , id]) => id === callId);
  if (!entry) return [];
  const list = entry[1].list;
  return Array.isArray(list) ? (list as T[]) : [];
}
