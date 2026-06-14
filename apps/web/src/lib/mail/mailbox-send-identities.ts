import type { MailboxAddressPatternType } from "@prisma/client";
import {
  addAccountEmailAlias,
  createAccountSendIdentity,
  deleteAccountSendIdentity,
  findSendIdentityIdByEmail,
  isStalwartFailure,
  listAccountSendIdentities,
  removeAccountEmailAlias,
} from "@/lib/stalwart/client";

export type MailboxSendAddress = {
  email: string;
  /** Adresse exacte utilisable comme expéditeur dans Bulwark. */
  sendable: boolean;
  patternType: MailboxAddressPatternType;
  labelKey: "primaryAddress" | "exactAlias" | "wildcardLocalPattern" | "wildcardDomainPattern";
};

/** Adresses affichables comme expéditeur : principale + alias exacts synchronisés. */
export function resolveMailboxSendAddresses(input: {
  primaryAddress: string;
  alternateAddresses: Array<{ address: string; patternType: MailboxAddressPatternType }>;
}): MailboxSendAddress[] {
  const results: MailboxSendAddress[] = [
    {
      email: input.primaryAddress,
      sendable: true,
      patternType: "EXACT",
      labelKey: "primaryAddress",
    },
  ];

  for (const row of input.alternateAddresses) {
    if (row.patternType === "EXACT") {
      results.push({
        email: row.address,
        sendable: true,
        patternType: "EXACT",
        labelKey: "exactAlias",
      });
      continue;
    }

    results.push({
      email: row.address,
      sendable: false,
      patternType: row.patternType,
      labelKey:
        row.patternType === "WILDCARD_LOCAL" ? "wildcardLocalPattern" : "wildcardDomainPattern",
    });
  }

  return results;
}

/** Provisionne alias exact + identité JMAP pour l'envoi Bulwark. */
export async function syncExactAliasSendIdentity(input: {
  stalwartAccountId: string;
  aliasEmail: string;
  stalwartDomainId: string;
  displayName?: string | null;
}): Promise<boolean> {
  const aliasRes = await addAccountEmailAlias(
    input.stalwartAccountId,
    input.aliasEmail,
    input.stalwartDomainId
  );
  if (isStalwartFailure(aliasRes)) return false;

  const identitiesRes = await listAccountSendIdentities(input.stalwartAccountId);
  if (isStalwartFailure(identitiesRes)) return false;

  const existingId = findSendIdentityIdByEmail(identitiesRes, input.aliasEmail);
  if (existingId) return true;

  const createRes = await createAccountSendIdentity(
    input.stalwartAccountId,
    input.aliasEmail,
    input.displayName
  );
  return !isStalwartFailure(createRes);
}

/** Retire alias exact + identité JMAP associée. */
export async function removeExactAliasSendIdentity(input: {
  stalwartAccountId: string;
  aliasEmail: string;
  stalwartDomainId: string;
}): Promise<boolean> {
  const aliasRes = await removeAccountEmailAlias(
    input.stalwartAccountId,
    input.aliasEmail,
    input.stalwartDomainId
  );
  if (isStalwartFailure(aliasRes)) return false;

  const identitiesRes = await listAccountSendIdentities(input.stalwartAccountId);
  if (isStalwartFailure(identitiesRes)) return false;

  const identityId = findSendIdentityIdByEmail(identitiesRes, input.aliasEmail);
  if (!identityId) return true;

  const deleteRes = await deleteAccountSendIdentity(input.stalwartAccountId, identityId);
  return !isStalwartFailure(deleteRes);
}

/** Répare les identités d'envoi pour tous les alias exacts d'une boîte. */
export async function syncMailboxSendIdentities(input: {
  stalwartAccountId: string;
  stalwartDomainId: string;
  displayName?: string | null;
  exactAliasEmails: string[];
}): Promise<void> {
  for (const aliasEmail of input.exactAliasEmails) {
    await syncExactAliasSendIdentity({
      stalwartAccountId: input.stalwartAccountId,
      aliasEmail,
      stalwartDomainId: input.stalwartDomainId,
      displayName: input.displayName,
    });
  }
}
