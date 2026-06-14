import { NextRequest, NextResponse } from "next/server";
import { isDbUnavailableError } from "@/lib/auth-errors";
import { resolveMigrationForAdmin } from "@/lib/migration/access";
import { signOAuthState } from "@/lib/migration/oauth-state";
import {
  buildGoogleAuthUrl,
  getGoogleOAuthMissingEnvVars,
  isGoogleOAuthConfigured,
} from "@/lib/migration/providers/google";

const OAUTH_ENV_HINT =
  "Définissez ces variables dans le .env à la racine du dépôt (voir .env.example). apps/web/.env.local peut surcharger.";

export const dynamic = "force-dynamic";

function redirectUri(req: NextRequest) {
  const origin = process.env.AUTH_URL ?? req.nextUrl.origin;
  return `${origin}/api/migration/oauth/google/callback`;
}

export async function GET(req: NextRequest) {
  const migrationId = req.nextUrl.searchParams.get("migrationId");
  if (!migrationId) {
    return NextResponse.json({ error: "missing_migration" }, { status: 400 });
  }

  let resolved;
  try {
    resolved = await resolveMigrationForAdmin(migrationId);
  } catch (err) {
    if (isDbUnavailableError(err)) {
      return NextResponse.json({ error: "database_unavailable" }, { status: 503 });
    }
    throw err;
  }
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 403 });
  }

  if (resolved.migration.provider !== "GOOGLE") {
    return NextResponse.json({ error: "invalid_provider" }, { status: 400 });
  }

  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      {
        error: "oauth_not_configured",
        provider: "google",
        missingEnvVars: getGoogleOAuthMissingEnvVars(),
        hint: OAUTH_ENV_HINT,
      },
      { status: 503 }
    );
  }

  const state = signOAuthState(migrationId);
  const url = buildGoogleAuthUrl(redirectUri(req), state);
  if (!url) {
    return NextResponse.json(
      {
        error: "oauth_not_configured",
        provider: "google",
        missingEnvVars: getGoogleOAuthMissingEnvVars(),
        hint: OAUTH_ENV_HINT,
      },
      { status: 503 }
    );
  }

  return NextResponse.redirect(url);
}
