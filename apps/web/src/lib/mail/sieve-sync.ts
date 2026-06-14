import { compileSieveScript, type SieveFilterRule } from "@/lib/mail/sieve-compile";
import type { JmapResponseBody, JmapSession } from "@/lib/mail/jmap-types";
import { fetchJmapSession } from "@/lib/mail/jmap-proxy";
import { getStalwartJmapUrl } from "@/lib/stalwart/client";
import type { WebmailTokens } from "@/lib/stalwart/webmail-auth";

const SIEVE_USING = [
  "urn:ietf:params:jmap:core",
  "urn:ietf:params:jmap:sieve",
] as const;

function resolveSieveAccountId(session: JmapSession): string {
  const sieveAccount = session.primaryAccounts?.["urn:ietf:params:jmap:sieve"];
  if (sieveAccount) return sieveAccount;
  const mailAccount = session.primaryAccounts?.["urn:ietf:params:jmap:mail"];
  if (mailAccount) return mailAccount;
  const fallback = session.accounts ? Object.keys(session.accounts)[0] : undefined;
  if (!fallback) throw new Error("no_sieve_account");
  return fallback;
}

async function jmapUserCall(tokens: WebmailTokens, methodCalls: [string, Record<string, unknown>, string][]) {
  const base = getStalwartJmapUrl();
  if (!base) throw new Error("unconfigured");

  const response = await fetch(`${base}/jmap`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ using: [...SIEVE_USING], methodCalls }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`jmap_sieve_${response.status}`);
  }

  return (await response.json()) as JmapResponseBody;
}

function extractCreatedId(res: JmapResponseBody, callId: string): string | null {
  const entry = res.methodResponses.find(([, , id]) => id === callId);
  if (!entry || entry[0] === "error") return null;
  const created = entry[1].created as Record<string, { id?: string }> | undefined;
  if (!created) return null;
  const first = Object.values(created)[0];
  return first?.id ?? null;
}

function extractScriptIds(res: JmapResponseBody, callId: string): string[] {
  const entry = res.methodResponses.find(([, , id]) => id === callId);
  if (!entry || entry[0] === "error") return [];
  const list = entry[1].list as Array<{ id: string; name?: string }> | undefined;
  if (!Array.isArray(list)) return [];
  return list
    .filter((item) => item.name === "framm-filters" || item.name === "filters")
    .map((item) => item.id);
}

async function uploadSieveBlob(
  tokens: WebmailTokens,
  session: JmapSession,
  accountId: string,
  content: string
): Promise<string> {
  if (!session.uploadUrl) throw new Error("sieve_upload_url_missing");

  const uploadUrl = session.uploadUrl.replace("{accountId}", encodeURIComponent(accountId));
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Content-Type": "application/sieve",
    },
    body: content,
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`sieve_blob_upload_${response.status}`);
  }

  const result = (await response.json()) as Record<string, unknown>;
  if (typeof result.blobId === "string") return result.blobId;
  const nested = result[accountId] as { blobId?: string } | undefined;
  if (nested?.blobId) return nested.blobId;
  throw new Error("sieve_blob_id_missing");
}

/** Pousse le script Sieve compilé sur Stalwart pour la boîte (session utilisateur). */
export async function syncMailboxSieveFilters(
  tokens: WebmailTokens,
  rules: SieveFilterRule[]
): Promise<{ ok: true } | { error: string }> {
  const session = await fetchJmapSession(tokens);
  const accountId = resolveSieveAccountId(session);
  const script = compileSieveScript(rules);

  const existing = await jmapUserCall(tokens, [
    ["SieveScript/get", { accountId }, "sg0"],
  ]);
  const existingIds = extractScriptIds(existing, "sg0");

  if (rules.length === 0) {
    if (existingIds.length === 0) return { ok: true };
    const deactivate = await jmapUserCall(tokens, [
      [
        "SieveScript/set",
        { accountId, destroy: existingIds, onSuccessDeactivateScript: true },
        "sd0",
      ],
    ]);
    if (deactivate.methodResponses[0]?.[0] === "error") {
      return { error: "sieve_deactivate_failed" };
    }
    return { ok: true };
  }

  const blobId = await uploadSieveBlob(tokens, session, accountId, script);
  const createId = `framm-${Date.now()}`;

  const setRes = await jmapUserCall(tokens, [
    [
      "SieveScript/set",
      {
        accountId,
        create: {
          [createId]: {
            name: "framm-filters",
            blobId,
          },
        },
        onSuccessActivateScript: `#${createId}`,
        destroy: existingIds.length > 0 ? existingIds : undefined,
      },
      "ss0",
    ],
  ]);

  const first = setRes.methodResponses[0];
  if (!first || first[0] === "error") {
    return { error: String(first?.[1]?.type ?? "sieve_set_failed") };
  }

  const notCreated = first[1].notCreated as Record<string, unknown> | undefined;
  if (notCreated && Object.keys(notCreated).length > 0) {
    return { error: "sieve_set_failed" };
  }

  if (!extractCreatedId(setRes, "ss0")) {
    return { error: "sieve_set_failed" };
  }

  return { ok: true };
}
