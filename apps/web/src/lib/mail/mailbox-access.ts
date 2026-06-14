import { auth } from "@/lib/auth";
import { getOrgId } from "@/lib/auth-utils";
import { unsealSecret } from "@/lib/crypto/seal";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/tenant";
import type { UserRole } from "@prisma/client";
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
  credentialsEnc: string | null;
  isShared: boolean;
};

export type AccessibleMailbox = {
  id: string;
  address: string;
  displayName: string | null;
  isShared: boolean;
  isDelegated: boolean;
  delegationPermission?: "READ" | "SEND";
};

async function mailboxMembershipAllowed(
  mailboxOrganizationId: string,
  userId: string,
  globalRole: UserRole,
  activeOrgId: string | null
): Promise<boolean> {
  const member = await getMembership(userId, mailboxOrganizationId);
  if (!member) return false;
  if (globalRole === "BUREAU") return true;
  return mailboxOrganizationId === activeOrgId;
}

async function userHasMailboxAccess(
  mailboxId: string,
  mailboxOrganizationId: string,
  userId: string,
  globalRole: UserRole,
  activeOrgId: string | null
): Promise<boolean> {
  if (!(await mailboxMembershipAllowed(mailboxOrganizationId, userId, globalRole, activeOrgId))) {
    return false;
  }

  const [userLink, sharedMember, delegation] = await Promise.all([
    prisma.userMailbox.findFirst({
      where: { userId, mailboxId, organizationId: mailboxOrganizationId },
      select: { id: true },
    }),
    prisma.sharedMailboxMember.findFirst({
      where: {
        userId,
        sharedMailbox: { mailboxId, organizationId: mailboxOrganizationId },
      },
      select: { id: true },
    }),
    prisma.mailboxDelegation.findFirst({
      where: { mailboxId, delegateUserId: userId, organizationId: mailboxOrganizationId },
      select: { id: true },
    }),
  ]);

  if (userLink || sharedMember || delegation) return true;

  if (globalRole === "BUREAU") return true;

  const isOrgAdmin = await prisma.organizationMember.findFirst({
    where: {
      userId,
      organizationId: mailboxOrganizationId,
      role: { in: ["BUREAU", "ASSOC_ADMIN"] },
    },
    select: { id: true },
  });
  return Boolean(isOrgAdmin);
}

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

  const activeOrgId = getOrgId(session);
  if (!activeOrgId && session.user.role !== "BUREAU") return { error: "forbidden" };

  const mailbox = await prisma.mailbox.findFirst({
    where: { id: mailboxId },
    select: {
      id: true,
      address: true,
      credentialsEnc: true,
      organizationId: true,
      isShared: true,
    },
  });
  if (!mailbox) return { error: "not_found" };

  const allowed = await userHasMailboxAccess(
    mailbox.id,
    mailbox.organizationId,
    session.user.id,
    session.user.role,
    activeOrgId
  );
  if (!allowed) return { error: "forbidden" };

  return {
    mailbox: {
      id: mailbox.id,
      address: mailbox.address,
      credentialsEnc: mailbox.credentialsEnc,
      isShared: mailbox.isShared,
    },
  };
}

/** Boîtes accessibles à l'utilisateur courant (principale + partagées). */
export async function listAccessibleMailboxes(
  userId: string,
  orgId: string
): Promise<AccessibleMailbox[]> {
  const [userLinks, sharedMembers, delegations] = await Promise.all([
    prisma.userMailbox.findMany({
      where: { userId, organizationId: orgId },
      include: {
        mailbox: { select: { id: true, address: true, displayName: true, isShared: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.sharedMailboxMember.findMany({
      where: { userId, sharedMailbox: { organizationId: orgId } },
      include: {
        sharedMailbox: {
          include: {
            mailbox: {
              select: { id: true, address: true, displayName: true, isShared: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.mailboxDelegation.findMany({
      where: { delegateUserId: userId, organizationId: orgId },
      include: {
        mailbox: { select: { id: true, address: true, displayName: true, isShared: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const seen = new Set<string>();
  const result: AccessibleMailbox[] = [];

  for (const link of userLinks) {
    if (link.mailbox.isShared || seen.has(link.mailbox.id)) continue;
    seen.add(link.mailbox.id);
    result.push({
      id: link.mailbox.id,
      address: link.mailbox.address,
      displayName: link.mailbox.displayName,
      isShared: false,
      isDelegated: false,
    });
  }

  for (const delegation of delegations) {
    const mailbox = delegation.mailbox;
    if (seen.has(mailbox.id)) continue;
    seen.add(mailbox.id);
    result.push({
      id: mailbox.id,
      address: mailbox.address,
      displayName: mailbox.displayName,
      isShared: false,
      isDelegated: true,
      delegationPermission: delegation.permission,
    });
  }

  for (const member of sharedMembers) {
    const mailbox = member.sharedMailbox.mailbox;
    if (!mailbox || seen.has(mailbox.id)) continue;
    seen.add(mailbox.id);
    result.push({
      id: mailbox.id,
      address: mailbox.address,
      displayName: member.sharedMailbox.displayName ?? mailbox.displayName,
      isShared: true,
      isDelegated: false,
    });
  }

  return result;
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
