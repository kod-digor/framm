import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getMailboxWebmailTokens,
  resolveAuthorizedMailbox,
  type MailboxAccessError,
} from "@/lib/mail/mailbox-access";
import { fetchInboxEmails, proxyJmapCall } from "@/lib/mail/jmap-proxy";
import type { JmapRequestBody } from "@/lib/mail/jmap-types";

export const dynamic = "force-dynamic";

const ERROR_STATUS: Record<MailboxAccessError, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  no_credentials: 403,
  credentials_invalid: 403,
  auth_failed: 502,
  auth_mfa: 403,
  auth_upstream: 502,
  unconfigured: 503,
};

async function loadTokens(mailboxId: string) {
  const access = await resolveAuthorizedMailbox(mailboxId);
  if ("error" in access) return access;

  const row = await prisma.mailbox.findFirst({
    where: { id: mailboxId },
    select: { credentialsEnc: true, address: true },
  });
  if (!row?.credentialsEnc) return { error: "no_credentials" as const };

  return getMailboxWebmailTokens(mailboxId, row.credentialsEnc, row.address);
}

function errorResponse(code: MailboxAccessError | string, status = 400) {
  return NextResponse.json({ error: code }, { status });
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ mailboxId: string }> }
) {
  const { mailboxId } = await ctx.params;
  const tokenResult = await loadTokens(mailboxId);
  if ("error" in tokenResult) {
    return errorResponse(tokenResult.error, ERROR_STATUS[tokenResult.error]);
  }

  try {
    const { accountId, mailboxId: inboxId, emails } = await fetchInboxEmails(
      tokenResult.tokens
    );
    return NextResponse.json({ accountId, mailboxId: inboxId, emails });
  } catch (err) {
    const code = err instanceof Error ? err.message : "jmap_error";
    return errorResponse(code, 502);
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ mailboxId: string }> }
) {
  const { mailboxId } = await ctx.params;
  const tokenResult = await loadTokens(mailboxId);
  if ("error" in tokenResult) {
    return errorResponse(tokenResult.error, ERROR_STATUS[tokenResult.error]);
  }

  let body: JmapRequestBody;
  try {
    body = (await req.json()) as JmapRequestBody;
  } catch {
    return errorResponse("invalid_body");
  }

  if (!body.using?.length || !body.methodCalls?.length) {
    return errorResponse("invalid_jmap_body");
  }

  try {
    const result = await proxyJmapCall(tokenResult.tokens, body);
    return NextResponse.json(result);
  } catch (err) {
    const code = err instanceof Error ? err.message : "jmap_error";
    return errorResponse(code, 502);
  }
}
