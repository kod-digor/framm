import { NextRequest, NextResponse } from "next/server";
import { resolveMigrationForAdmin } from "@/lib/migration/access";
import { signOAuthState } from "@/lib/migration/oauth-state";
import { buildMicrosoftAuthUrl, isMicrosoftOAuthConfigured } from "@/lib/migration/providers/microsoft";

export const dynamic = "force-dynamic";

function redirectUri(req: NextRequest) {
  const origin = process.env.AUTH_URL ?? req.nextUrl.origin;
  return `${origin}/api/migration/oauth/microsoft/callback`;
}

export async function GET(req: NextRequest) {
  const migrationId = req.nextUrl.searchParams.get("migrationId");
  if (!migrationId) {
    return NextResponse.json({ error: "missing_migration" }, { status: 400 });
  }

  const resolved = await resolveMigrationForAdmin(migrationId);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 403 });
  }

  if (resolved.migration.provider !== "MICROSOFT") {
    return NextResponse.json({ error: "invalid_provider" }, { status: 400 });
  }

  if (!isMicrosoftOAuthConfigured()) {
    return NextResponse.json({ error: "oauth_not_configured" }, { status: 503 });
  }

  const state = signOAuthState(migrationId);
  const url = buildMicrosoftAuthUrl(redirectUri(req), state);
  if (!url) {
    return NextResponse.json({ error: "oauth_not_configured" }, { status: 503 });
  }

  return NextResponse.redirect(url);
}
