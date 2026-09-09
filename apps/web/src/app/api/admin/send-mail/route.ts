import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  adminSendMailSchema,
  isAdminMailTokenConfigured,
  sendAdminMail,
  verifyAdminMailToken,
} from "@/lib/mail/admin-send";

export const dynamic = "force-dynamic";

function extractBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  return req.headers.get("x-admin-mail-token");
}

async function isAuthorized(req: NextRequest): Promise<boolean> {
  if (verifyAdminMailToken(extractBearerToken(req))) return true;

  const session = await auth();
  return session?.user?.role === "BUREAU";
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = adminSendMailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await sendAdminMail(parsed.data);
  if (!result.ok) {
    const status = result.code === "invalid_from" ? 422 : 502;
    return NextResponse.json({ error: result.code, detail: result.detail }, { status });
  }

  return NextResponse.json({
    ok: true,
    via: result.via,
    messageId: result.messageId,
  });
}

/** Diagnostic léger : indique si l'envoi admin est configuré (token présent). */
export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    tokenConfigured: isAdminMailTokenConfigured(),
  });
}
