import { unsealSecret } from "@/lib/crypto/seal";
import { refreshGoogleAccessToken } from "@/lib/migration/providers/google";
import { refreshMicrosoftAccessToken } from "@/lib/migration/providers/microsoft";
import type { ImapSourceCredentials } from "@/lib/migration/types";

export type OAuthAccessResult = {
  accessToken: string | null;
  error?: "oauth_refresh_failed" | "oauth_token_missing";
};

/** Préfère le refresh token pour obtenir un access token valide (API discovery / import). */
export async function resolveOAuthAccessToken(
  source: ImapSourceCredentials,
  oauthRefreshTokenEnc: string | null
): Promise<OAuthAccessResult> {
  let refreshFailed = false;

  if (source.oauthProvider && oauthRefreshTokenEnc) {
    const refreshToken = unsealSecret(oauthRefreshTokenEnc);
    if (refreshToken) {
      const refreshed =
        source.oauthProvider === "google"
          ? await refreshGoogleAccessToken(refreshToken)
          : await refreshMicrosoftAccessToken(refreshToken);
      if (refreshed?.accessToken) {
        return { accessToken: refreshed.accessToken };
      }
      refreshFailed = true;
    }
  }

  if (source.oauthAccessToken) {
    return { accessToken: source.oauthAccessToken };
  }

  if (refreshFailed) {
    return { accessToken: null, error: "oauth_refresh_failed" };
  }

  if (source.oauthProvider) {
    return { accessToken: null, error: "oauth_token_missing" };
  }

  return { accessToken: null };
}
