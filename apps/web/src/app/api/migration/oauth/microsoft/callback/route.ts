import { NextRequest, NextResponse } from "next/server";
import { verifyOAuthState } from "@/lib/migration/oauth-state";
import { exchangeMicrosoftCode } from "@/lib/migration/providers/microsoft";
import { storeOAuthTokens } from "@/lib/migration/orchestrator";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function usersRedirect(req: NextRequest, params: Record<string, string>) {
  const origin = process.env.AUTH_URL ?? req.nextUrl.origin;
  const query = new URLSearchParams(params);
  return NextResponse.redirect(`${origin}/dashboard/users?${query.toString()}`);
}

function redirectUri(req: NextRequest) {
  const origin = process.env.AUTH_URL ?? req.nextUrl.origin;
  return `${origin}/api/migration/oauth/microsoft/callback`;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");

  if (oauthError) {
    return usersRedirect(req, { migrationError: oauthError });
  }

  if (!code || !state) {
    return usersRedirect(req, { migrationError: "missing_params" });
  }

  const migrationId = verifyOAuthState(state);
  if (!migrationId) {
    return usersRedirect(req, { migrationError: "invalid_state" });
  }

  const migration = await prisma.mailboxMigration.findUnique({
    where: { id: migrationId },
  });

  if (!migration || migration.provider !== "MICROSOFT") {
    return usersRedirect(req, { migrationError: "not_found" });
  }

  const tokens = await exchangeMicrosoftCode(code, redirectUri(req));
  if (!tokens) {
    return usersRedirect(req, { migrationError: "token_exchange_failed", migrationId });
  }

  const email = tokens.email ?? migration.sourceAddress ?? migration.targetAddress;
  await storeOAuthTokens(migrationId, { ...tokens, email }, email, "microsoft");

  return usersRedirect(req, {
    migrationId,
    migrationMailboxId: migration.mailboxId,
    migrationStep: "scope",
  });
}
