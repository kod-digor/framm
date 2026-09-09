import { obtainWebmailTokens } from "@/lib/stalwart/webmail-auth";
import type { OutboundMailPayload } from "@/lib/mail/outbound-smtp";

type JmapSession = {
  apiUrl?: string;
  primaryAccounts?: Record<string, string>;
};

function normalizeRecipients(to: string | string[]): string[] {
  return Array.isArray(to) ? to : [to];
}

async function fetchJmapSession(
  base: string,
  accessToken: string
): Promise<{ accountId: string; apiUrl: string } | null> {
  const sessionRes = await fetch(`${base}/.well-known/jmap`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!sessionRes.ok) return null;

  const session = (await sessionRes.json()) as JmapSession;
  const accountId = session.primaryAccounts?.["urn:ietf:params:jmap:mail"];
  if (!accountId) return null;

  return {
    accountId,
    apiUrl: session.apiUrl ?? `${base}/jmap`,
  };
}

async function jmapCall(
  apiUrl: string,
  accessToken: string,
  methodCalls: [string, Record<string, unknown>, string][]
): Promise<unknown> {
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      using: [
        "urn:ietf:params:jmap:core",
        "urn:ietf:params:jmap:mail",
        "urn:ietf:params:jmap:submission",
      ],
      methodCalls,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    throw new Error(`JMAP HTTP ${res.status}`);
  }
  return res.json();
}

function extractCreatedId(res: unknown, method: string): string | null {
  if (!res || typeof res !== "object" || !("methodResponses" in res)) return null;
  const responses = (res as { methodResponses: unknown[][] }).methodResponses;
  const entry = responses?.find(([name]) => name === method);
  const body = entry?.[1] as { created?: Record<string, { id?: string }> } | undefined;
  const created = body?.created;
  if (!created) return null;
  const first = Object.values(created)[0];
  return first?.id ?? null;
}

function extractQueryIds(res: unknown): string[] {
  if (!res || typeof res !== "object" || !("methodResponses" in res)) return [];
  const body = (res as { methodResponses: unknown[][] }).methodResponses?.[0]?.[1] as
    | { ids?: string[] }
    | undefined;
  return body?.ids ?? [];
}

function extractIdentityId(res: unknown): string | null {
  if (!res || typeof res !== "object" || !("methodResponses" in res)) return null;
  const body = (res as { methodResponses: unknown[][] }).methodResponses?.[0]?.[1] as
    | { list?: { id?: string }[] }
    | undefined;
  return body?.list?.[0]?.id ?? null;
}

/** Envoi via JMAP/HTTPS (port 443) — compatible pods K8s Scaleway (SMTP 465 bloqué). */
export async function sendViaStalwartJmap(
  mailboxAddress: string,
  mailboxPassword: string,
  payload: OutboundMailPayload
): Promise<{ ok: true; messageId: string; via: string } | { ok: false; detail: string }> {
  const base = process.env.STALWART_URL?.replace(/\/$/, "");
  if (!base) {
    return { ok: false, detail: "STALWART_URL non configuré" };
  }

  try {
    const tokens = await obtainWebmailTokens(mailboxAddress, mailboxPassword);
    const session = await fetchJmapSession(base, tokens.accessToken);
    if (!session) {
      return { ok: false, detail: "Session JMAP Stalwart indisponible" };
    }

    const fromEmail = mailboxAddress.trim().toLowerCase();
    const toList = normalizeRecipients(payload.to).map((email) => ({ email: email.trim() }));

    const mailboxRes = await jmapCall(session.apiUrl, tokens.accessToken, [
      ["Mailbox/query", { accountId: session.accountId, filter: { role: "drafts" } }, "mq"],
    ]);
    const draftsId = extractQueryIds(mailboxRes)[0];
    if (!draftsId) {
      return { ok: false, detail: "Boîte Brouillons introuvable" };
    }

    const identityRes = await jmapCall(session.apiUrl, tokens.accessToken, [
      ["Identity/get", { accountId: session.accountId, ids: null }, "ig"],
    ]);
    const identityId = extractIdentityId(identityRes);
    if (!identityId) {
      return { ok: false, detail: "Identité d'envoi introuvable" };
    }

    const bodyPartId = "body";
    const emailCreate: Record<string, unknown> = {
      mailboxIds: { [draftsId]: true },
      from: [{ email: fromEmail }],
      to: toList,
      subject: payload.subject,
      keywords: { $draft: true },
      bodyValues: {
        [bodyPartId]: { value: payload.text ?? payload.html ?? "" },
      },
    };

    if (payload.html?.trim()) {
      emailCreate.htmlBody = [{ partId: bodyPartId, type: "text/html" }];
    } else {
      emailCreate.textBody = [{ partId: bodyPartId, type: "text/plain" }];
    }

    const sendRes = await jmapCall(session.apiUrl, tokens.accessToken, [
      [
        "Email/set",
        { accountId: session.accountId, create: { draft: emailCreate } },
        "e0",
      ],
      [
        "EmailSubmission/set",
        {
          accountId: session.accountId,
          create: { sub: { emailId: "#draft", identityId } },
        },
        "s0",
      ],
    ]);

    const submissionId = extractCreatedId(sendRes, "EmailSubmission/set");
    const emailId = extractCreatedId(sendRes, "Email/set");
    const messageId = submissionId ?? emailId ?? "unknown";

    return { ok: true, messageId, via: `${base}/jmap` };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, detail };
  }
}
