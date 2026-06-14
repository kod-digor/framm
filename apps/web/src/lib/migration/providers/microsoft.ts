import type { OAuthTokens } from "@/lib/migration/types";

const MS_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MS_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

export const MICROSOFT_IMAP = {
  host: "outlook.office365.com",
  port: 993,
} as const;

export const MICROSOFT_OAUTH_SCOPES = [
  "https://outlook.office365.com/IMAP.AccessAsUser.All",
  "offline_access",
  "email",
  "openid",
] as const;

function getMicrosoftConfig() {
  const clientId = process.env.MICROSOFT_MIGRATION_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_MIGRATION_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isMicrosoftOAuthConfigured(): boolean {
  return getMicrosoftConfig() !== null;
}

export function buildMicrosoftAuthUrl(redirectUri: string, state: string): string | null {
  const config = getMicrosoftConfig();
  if (!config) return null;

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: MICROSOFT_OAUTH_SCOPES.join(" "),
    response_mode: "query",
    state,
  });

  return `${MS_AUTH_URL}?${params.toString()}`;
}

export async function exchangeMicrosoftCode(
  code: string,
  redirectUri: string
): Promise<OAuthTokens | null> {
  const config = getMicrosoftConfig();
  if (!config) return null;

  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) return null;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
  };
}

export async function refreshMicrosoftAccessToken(
  refreshToken: string
): Promise<OAuthTokens | null> {
  const config = getMicrosoftConfig();
  if (!config) return null;

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) return null;

  return {
    accessToken: data.access_token,
    refreshToken,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
  };
}

export function getMicrosoftClientId(): string | null {
  return getMicrosoftConfig()?.clientId ?? null;
}
