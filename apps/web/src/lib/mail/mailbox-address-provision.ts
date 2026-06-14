import type { MailboxAddressPatternType } from "@prisma/client";
import {
  type ParsedAddressPattern,
  stalwartLocalWildcardIf,
} from "@/lib/mail/address-pattern";
import {
  removeExactAliasSendIdentity,
  syncExactAliasSendIdentity,
} from "@/lib/mail/mailbox-send-identities";
import {
  addAccountEmailAlias,
  createMailingListWithRecipients,
  deleteAlias,
  extractDomainCatchAllAddress,
  extractDomainSubAddressingRule,
  extractStalwartCreatedId,
  getDomain,
  isStalwartFailure,
  resetDomainSubAddressingEnabled,
  resolveEmailAliasStalwartId,
  type StalwartSubAddressingRule,
  updateDomainCatchAll,
  updateDomainSubAddressingCustom,
} from "@/lib/stalwart/client";

export type ProvisionMailboxAddressInput = {
  parsed: ParsedAddressPattern;
  mailboxAddress: string;
  stalwartDomainId: string;
  stalwartAccountId?: string | null;
  mailboxDisplayName?: string | null;
  existingStalwartAliasId?: string | null;
};

export type ProvisionMailboxAddressError =
  | "stalwartError"
  | "catchAllConflict"
  | "localPatternConflict"
  | "sendIdentityError";

export type ProvisionMailboxAddressResult = {
  stalwartAliasId: string | null;
};

function mailboxLocalPart(email: string): string {
  return email.split("@")[0] ?? email;
}

function mergeSubAddressingRule(
  existing: StalwartSubAddressingRule | null,
  localPrefix: string,
  targetLocalPart: string
): StalwartSubAddressingRule {
  const ifExpr = stalwartLocalWildcardIf(localPrefix);
  const match = [...(existing?.match ?? [])].filter((row) => row.if !== ifExpr);
  match.push({ if: ifExpr, then: targetLocalPart });
  return { match, else: existing?.else ?? "rcpt" };
}

function removeSubAddressingRule(
  existing: StalwartSubAddressingRule | null,
  localPrefix: string
): StalwartSubAddressingRule | null {
  if (!existing) return null;
  const ifExpr = stalwartLocalWildcardIf(localPrefix);
  const match = existing.match.filter((row) => row.if !== ifExpr);
  if (match.length === 0) return null;
  return { match, else: existing.else };
}

export async function provisionMailboxAddressPattern(
  input: ProvisionMailboxAddressInput
): Promise<ProvisionMailboxAddressResult | { error: ProvisionMailboxAddressError }> {
  const { parsed, mailboxAddress, stalwartDomainId } = input;

  if (parsed.patternType === "EXACT") {
    if (input.stalwartAccountId) {
      const aliasRes = await addAccountEmailAlias(
        input.stalwartAccountId,
        parsed.canonical,
        stalwartDomainId
      );
      if (isStalwartFailure(aliasRes)) {
        return { error: "stalwartError" };
      }

      const identityOk = await syncExactAliasSendIdentity({
        stalwartAccountId: input.stalwartAccountId,
        aliasEmail: parsed.canonical,
        stalwartDomainId,
        displayName: input.mailboxDisplayName,
      });
      if (!identityOk) {
        return { error: "sendIdentityError" };
      }

      return { stalwartAliasId: null };
    }

    const stalwartRes = await createMailingListWithRecipients(
      parsed.canonical,
      [mailboxAddress],
      stalwartDomainId
    );
    if (isStalwartFailure(stalwartRes)) {
      return { error: "stalwartError" };
    }
    return {
      stalwartAliasId: extractStalwartCreatedId(stalwartRes),
    };
  }

  if (parsed.patternType === "WILDCARD_DOMAIN") {
    const domainRes = await getDomain(stalwartDomainId);
    if (isStalwartFailure(domainRes)) {
      return { error: "stalwartError" };
    }

    const currentCatchAll = extractDomainCatchAllAddress(domainRes, stalwartDomainId);
    if (currentCatchAll && currentCatchAll !== mailboxAddress) {
      return { error: "catchAllConflict" };
    }

    const updateRes = await updateDomainCatchAll(stalwartDomainId, mailboxAddress);
    if (isStalwartFailure(updateRes)) {
      return { error: "stalwartError" };
    }

    return { stalwartAliasId: null };
  }

  if (parsed.patternType === "WILDCARD_LOCAL" && parsed.localPrefix) {
    const domainRes = await getDomain(stalwartDomainId);
    if (isStalwartFailure(domainRes)) {
      return { error: "stalwartError" };
    }

    const existingRule = extractDomainSubAddressingRule(domainRes, stalwartDomainId);
    const targetLocalPart = mailboxLocalPart(mailboxAddress);
    const merged = mergeSubAddressingRule(existingRule, parsed.localPrefix, targetLocalPart);

    const conflicting = merged.match.find(
      (row) => row.if === stalwartLocalWildcardIf(parsed.localPrefix!) && row.then !== targetLocalPart
    );
    if (conflicting) {
      return { error: "localPatternConflict" };
    }

    const updateRes = await updateDomainSubAddressingCustom(stalwartDomainId, merged);
    if (isStalwartFailure(updateRes)) {
      return { error: "stalwartError" };
    }

    return { stalwartAliasId: null };
  }

  return { error: "stalwartError" };
}

export async function deprovisionMailboxAddressPattern(input: {
  patternType: MailboxAddressPatternType;
  address: string;
  localPrefix?: string | null;
  mailboxAddress: string;
  stalwartDomainId: string;
  stalwartAccountId?: string | null;
  stalwartAliasId?: string | null;
}): Promise<boolean> {
  if (input.patternType === "EXACT") {
    if (input.stalwartAccountId) {
      const ok = await removeExactAliasSendIdentity({
        stalwartAccountId: input.stalwartAccountId,
        aliasEmail: input.address,
        stalwartDomainId: input.stalwartDomainId,
      });
      if (!ok) return false;
    }

    const resolved = await resolveEmailAliasStalwartId(input.stalwartAliasId ?? null, input.address);
    if (resolved.id) {
      const delRes = await deleteAlias(resolved.id);
      if (isStalwartFailure(delRes)) return false;
    }
    return true;
  }

  if (input.patternType === "WILDCARD_DOMAIN") {
    const domainRes = await getDomain(input.stalwartDomainId);
    if (isStalwartFailure(domainRes)) return false;

    const currentCatchAll = extractDomainCatchAllAddress(domainRes, input.stalwartDomainId);
    if (currentCatchAll === input.mailboxAddress) {
      const updateRes = await updateDomainCatchAll(input.stalwartDomainId, null);
      if (isStalwartFailure(updateRes)) return false;
    }
    return true;
  }

  if (input.patternType === "WILDCARD_LOCAL" && input.localPrefix) {
    const domainRes = await getDomain(input.stalwartDomainId);
    if (isStalwartFailure(domainRes)) return false;

    const existingRule = extractDomainSubAddressingRule(domainRes, input.stalwartDomainId);
    const nextRule = removeSubAddressingRule(existingRule, input.localPrefix);

    if (!nextRule) {
      const resetRes = await resetDomainSubAddressingEnabled(input.stalwartDomainId);
      if (isStalwartFailure(resetRes)) return false;
      return true;
    }

    const updateRes = await updateDomainSubAddressingCustom(input.stalwartDomainId, nextRule);
    if (isStalwartFailure(updateRes)) return false;
    return true;
  }

  return true;
}
