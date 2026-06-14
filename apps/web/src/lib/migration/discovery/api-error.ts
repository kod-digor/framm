type GoogleApiErrorBody = {
  error?: {
    errors?: Array<{ reason?: string }>;
  };
};

const GOOGLE_API_DISABLED_REASONS = new Set([
  "accessNotConfigured",
  "SERVICE_DISABLED",
]);

export function classifyApiError(status: number, fallback: string): string {
  if (status === 401) return "token_expired";
  if (status === 403) return "insufficient_scope";
  return fallback;
}

/** Interprète le corps d'erreur JSON renvoyé par les APIs Google. */
export function classifyGoogleApiError(
  status: number,
  body: unknown,
  fallback: string,
  disabledFallback?: string
): string {
  const reasons = ((body as GoogleApiErrorBody)?.error?.errors ?? [])
    .map((entry) => entry.reason)
    .filter((reason): reason is string => Boolean(reason));

  if (disabledFallback && reasons.some((reason) => GOOGLE_API_DISABLED_REASONS.has(reason))) {
    return disabledFallback;
  }
  if (reasons.includes("insufficientPermissions")) {
    return "insufficient_scope";
  }
  return classifyApiError(status, fallback);
}

export const AUTH_UNAVAILABLE_REASONS = new Set([
  "token_expired",
  "insufficient_scope",
  "oauth_refresh_failed",
  "oauth_token_missing",
  "source_credentials_missing",
]);

export function statsNeedReauth(stats: {
  mail: { available: boolean; unavailableReason?: string };
  contacts: { available: boolean; unavailableReason?: string };
  calendar: { available: boolean; unavailableReason?: string };
}): boolean {
  return [stats.mail, stats.contacts, stats.calendar].some(
    (section) =>
      !section.available &&
      section.unavailableReason &&
      AUTH_UNAVAILABLE_REASONS.has(section.unavailableReason)
  );
}
