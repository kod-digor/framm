import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { unsealSecret } from "@/lib/crypto/seal";
import { prisma } from "@/lib/prisma";
import { obtainWebmailTokens, type WebmailTokens } from "@/lib/stalwart/webmail-auth";

export type MailboxAccessError =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "no_credentials"
  | "credentials_invalid"
  | "auth_failed"
  | "auth_mfa"
  | "auth_upstream"
  | "unconfigured";

export type AuthorizedMailbox = {
  id: string;
  address: string;
};

const tokenCache = new Map<string, { tokens: WebmailTokens; expiresAt: number }>();

function mapAuthError(err: unknown): MailboxAccessError {
  if (!(err instanceof Error)) return "auth_upstream";
  switch (err.message) {
    case "credentials_invalid":
      return "credentials_invalid";
    case "stalwart_credentials_rejected":
    case "stalwart_auth_unexpected":
      return "auth_failed";
    case "stalwart_mfa_required":
      return "auth_mfa";
    case "STALWART_URL is not configured":
      return "unconfigured";
    default:
      return "auth_upstream";
  }
}

export async function resolveAuthorizedMailbox(
  mailboxId: string
): Promise<{ mailbox: AuthorizedMailbox } | { error: MailboxAccessError }> {
  const session = await auth();
  if (!session?.user) return { error: "unauthorized" };

  const orgId = getOrgId(session);
  if (!orgId) return { error: "forbidden" };

  const mailbox = await prisma.mailbox.findFirst({
    where: { id: mailboxId, organizationId: orgId },
    select: { id: true, address: true, credentialsEnc: true },
  });
  if (!mailbox) return { error: "not_found" };
  if (!mailbox.credentialsEnc) return { error: "no_credentials" };

  return { mailbox: { id: mailbox.id, address: mailbox.address } };
}

export async function getMailboxWebmailTokens(
  mailboxId: string,
  credentialsEnc: string,
  address: string
): Promise<{ tokens: WebmailTokens } | { error: MailboxAccessError }> {
  const cached = tokenCache.get(mailboxId);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return { tokens: cached.tokens };
  }

  const password = unsealSecret(credentialsEnc);
  if (!password) return { error: "credentials_invalid" };

  try {
    const tokens = await obtainWebmailTokens(address, password);
    tokenCache.set(mailboxId, {
      tokens,
      expiresAt: Date.now() + tokens.expiresIn * 1000,
    });
    return { tokens };
  } catch (err) {
    return { error: mapAuthError(err) };
  }
}

export function invalidateMailboxTokens(mailboxId: string) {
  tokenCache.delete(mailboxId);
}
