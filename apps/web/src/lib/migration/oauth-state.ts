import { createHmac, timingSafeEqual } from "node:crypto";

function getStateSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required for OAuth state");
  return secret;
}

/** State signé : migrationId + timestamp pour limiter la reutilisation. */
export function signOAuthState(migrationId: string): string {
  const payload = `${migrationId}:${Date.now()}`;
  const sig = createHmac("sha256", getStateSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}:${sig}`;
}

export function verifyOAuthState(state: string): string | null {
  const parts = state.split(":");
  if (parts.length !== 3) return null;

  const [migrationId, timestamp, sig] = parts;
  if (!migrationId || !timestamp || !sig) return null;

  const age = Date.now() - Number(timestamp);
  if (!Number.isFinite(age) || age < 0 || age > 30 * 60 * 1000) return null;

  const payload = `${migrationId}:${timestamp}`;
  const expected = createHmac("sha256", getStateSecret())
    .update(payload)
    .digest("base64url");

  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  return migrationId;
}
