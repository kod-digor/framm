/**
 * Types fondation email Workspace — plusieurs adresses → une boîte, boîtes partagées multi-membres.
 * Persistance Prisma : MailboxAddress, UserMailbox, SharedMailbox, SharedMailboxMember.
 */

export type MailboxAddressRecord = {
  id: string;
  organizationId: string;
  mailboxId: string;
  address: string;
  stalwartAliasId: string | null;
};

export type UserMailboxLink = {
  id: string;
  userId: string;
  mailboxId: string;
  organizationId: string;
  isPrimary: boolean;
};

export type SharedMailboxRecord = {
  id: string;
  organizationId: string;
  address: string;
  displayName: string | null;
  mailboxId: string;
  stalwartAliasId: string | null;
};

export type SharedMailboxMemberRecord = {
  id: string;
  sharedMailboxId: string;
  userId: string;
};

/** Indique si une adresse est une alias secondaire rattachée à une boîte. */
export function isSecondaryMailboxAddress(
  address: string,
  mailboxId: string,
  alternates: MailboxAddressRecord[]
): boolean {
  return alternates.some((a) => a.address === address && a.mailboxId === mailboxId);
}
