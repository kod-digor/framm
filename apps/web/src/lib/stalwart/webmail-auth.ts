import { getWebmailExternalUrl } from "@/lib/stalwart/client";

export const STALWART_WEBUI_CLIENT_ID = "stalwart-webui";

export type WebmailTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  tokenEndpoint: string;
  endSessionEndpoint: string | null;
};

type AuthResponse =
  | { type: "authenticated"; client_code?: string; clientCode?: string }
  | { type: "mfaRequired" }
  | { type: "failure" };

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

function accountRedirectUri(base: string): string {
  return `${base}/account/oauth/callback`;
}

/** Obtient des tokens OAuth Stalwart pour le portail /account/ (sans interaction utilisateur). */
export async function obtainWebmailTokens(
  address: string,
  password: string
): Promise<WebmailTokens> {
  const base = getWebmailExternalUrl();
  if (!base) {
    throw new Error("WEBMAIL_URL is not configured");
  }

  const redirectUri = accountRedirectUri(base);
  const authRes = await fetch(`${base}/api/auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      type: "authCode",
      accountName: address,
      accountSecret: password,
      clientId: STALWART_WEBUI_CLIENT_ID,
      redirectUri,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!authRes.ok) {
    throw new Error(`Stalwart auth HTTP ${authRes.status}`);
  }

  const authData = (await authRes.json()) as AuthResponse;
  if (authData.type === "mfaRequired") {
    throw new Error("stalwart_mfa_required");
  }
  if (authData.type === "failure") {
    throw new Error("stalwart_credentials_rejected");
  }
  if (authData.type !== "authenticated") {
    throw new Error("stalwart_auth_unexpected");
  }
  const clientCode = authData.client_code ?? authData.clientCode;
  if (!clientCode) {
    throw new Error("stalwart_auth_unexpected");
  }

  const tokenRes = await fetch(`${base}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: clientCode,
      client_id: STALWART_WEBUI_CLIENT_ID,
      redirect_uri: redirectUri,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!tokenRes.ok) {
    throw new Error(`Stalwart token HTTP ${tokenRes.status}`);
  }

  const tokens = (await tokenRes.json()) as TokenResponse;
  if (!tokens.access_token) {
    throw new Error("Missing access token from Stalwart");
  }

  let endSessionEndpoint: string | null = null;
  try {
    const oidcRes = await fetch(`${base}/.well-known/openid-configuration`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (oidcRes.ok) {
      const oidc = (await oidcRes.json()) as { end_session_endpoint?: string };
      endSessionEndpoint = oidc.end_session_endpoint ?? null;
    }
  } catch {
    // endpoint optionnel pour le portail
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresIn: tokens.expires_in ?? 3600,
    tokenEndpoint: `${base}/auth/token`,
    endSessionEndpoint,
  };
}

/** Alias utilisé par les health checks admin — tokens OAuth portail /account/. */
export const obtainStalwartSession = obtainWebmailTokens;
