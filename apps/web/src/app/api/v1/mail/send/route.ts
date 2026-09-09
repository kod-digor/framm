import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasScope, MAIL_SEND_SCOPE, verifyBearerApiKey } from "@/lib/api-keys";
import { sendOrgMail } from "@/lib/mail/org-mail-send";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const sendBodySchema = z.object({
  from: z.string().min(3).max(320),
  to: z.union([z.string().min(3).max(320), z.array(z.string().min(3).max(320)).min(1).max(50)]),
  subject: z.string().min(1).max(998),
  text: z.string().max(1_000_000).optional(),
  html: z.string().max(2_000_000).optional(),
  replyTo: z.string().max(320).optional(),
});

const ERROR_STATUS: Record<string, number> = {
  unauthorized: 401,
  forbidden: 403,
  invalid_body: 400,
  invalid_from: 400,
  invalid_to: 400,
  missing_content: 400,
  domain_not_in_org: 403,
  domain_not_verified: 403,
  smtp_not_configured: 503,
  send_failed: 502,
};

export async function POST(req: NextRequest) {
  const apiKey = await verifyBearerApiKey(req.headers.get("authorization"));
  if (!apiKey) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!hasScope(apiKey.scopes, MAIL_SEND_SCOPE)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const parsed = sendBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const result = await sendOrgMail({
    organizationId: apiKey.organizationId,
    ...parsed.data,
  });

  if (!result.ok) {
    const status = ERROR_STATUS[result.error] ?? 400;
    return NextResponse.json(
      { error: result.error, ...(result.detail ? { detail: result.detail } : {}) },
      { status }
    );
  }

  await prisma.auditLog.create({
    data: {
      organizationId: apiKey.organizationId,
      action: "api.mail.send",
      target: parsed.data.from,
      metadata: {
        apiKeyId: apiKey.id,
        to: parsed.data.to,
        subject: parsed.data.subject,
        messageId: result.messageId,
      },
    },
  });

  return NextResponse.json({ ok: true, messageId: result.messageId });
}
