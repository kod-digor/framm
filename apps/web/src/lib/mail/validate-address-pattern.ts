import type { ParsedAddressPattern } from "@/lib/mail/address-pattern";
import {
  domainFqdnFromCanonical,
  localPrefixFromCanonical,
  stalwartLocalWildcardIf,
} from "@/lib/mail/address-pattern";
import { prisma } from "@/lib/prisma";
import {
  extractDomainCatchAllAddress,
  extractDomainSubAddressingRule,
  getDomain,
  isStalwartFailure,
} from "@/lib/stalwart/client";

export type AddressPatternConflictCode =
  | "exists"
  | "catchAllConflict"
  | "localPatternConflict"
  | "domainCatchAllConflict";

/** Vérifie les conflits Framm + Stalwart avant provision — aucun statut MANUAL. */
export async function validateAddressPatternConflicts(input: {
  orgId: string;
  mailboxId: string;
  mailboxAddress: string;
  parsed: ParsedAddressPattern;
  stalwartDomainId: string;
}): Promise<{ ok: true } | { ok: false; code: AddressPatternConflictCode }> {
  const { orgId, mailboxId, mailboxAddress, parsed, stalwartDomainId } = input;

  if (parsed.patternType === "WILDCARD_DOMAIN") {
    const existingCatchAll = await prisma.mailboxAddress.findFirst({
      where: {
        organizationId: orgId,
        patternType: "WILDCARD_DOMAIN",
        address: parsed.canonical,
        NOT: { mailboxId },
      },
    });
    if (existingCatchAll) return { ok: false, code: "catchAllConflict" };

    const domainRes = await getDomain(stalwartDomainId);
    if (isStalwartFailure(domainRes)) {
      return { ok: false, code: "domainCatchAllConflict" };
    }
    const currentCatchAll = extractDomainCatchAllAddress(domainRes, stalwartDomainId);
    if (currentCatchAll && currentCatchAll !== mailboxAddress) {
      return { ok: false, code: "domainCatchAllConflict" };
    }
    return { ok: true };
  }

  if (parsed.patternType === "WILDCARD_LOCAL" && parsed.localPrefix) {
    const canonicalPrefix = `${parsed.localPrefix}.*@${parsed.domainFqdn}`;
    const existingPattern = await prisma.mailboxAddress.findFirst({
      where: {
        organizationId: orgId,
        patternType: "WILDCARD_LOCAL",
        address: canonicalPrefix,
        NOT: { mailboxId },
      },
    });
    if (existingPattern) return { ok: false, code: "localPatternConflict" };

    const domainRes = await getDomain(stalwartDomainId);
    if (isStalwartFailure(domainRes)) {
      return { ok: false, code: "localPatternConflict" };
    }
    const rule = extractDomainSubAddressingRule(domainRes, stalwartDomainId);
    const ifExpr = stalwartLocalWildcardIf(parsed.localPrefix);
    const targetLocal = mailboxAddress.split("@")[0] ?? "";
    const conflicting = rule?.match.find(
      (row) => row.if === ifExpr && row.then !== targetLocal
    );
    if (conflicting) return { ok: false, code: "localPatternConflict" };
    return { ok: true };
  }

  return { ok: true };
}

/** Liste les motifs déjà pris sur un domaine (pour désactiver les options UI). */
export async function listDomainPatternReservations(orgId: string, domainFqdn: string) {
  const rows = await prisma.mailboxAddress.findMany({
    where: {
      organizationId: orgId,
      OR: [
        { address: { endsWith: `@${domainFqdn}` } },
        { address: `*@${domainFqdn}` },
      ],
    },
    select: {
      address: true,
      patternType: true,
      mailboxId: true,
      mailbox: { select: { address: true } },
    },
  });

  const catchAllMailboxIds = rows
    .filter((r) => r.patternType === "WILDCARD_DOMAIN")
    .map((r) => r.mailboxId);

  const localPrefixes = rows
    .filter((r) => r.patternType === "WILDCARD_LOCAL")
    .map((r) => localPrefixFromCanonical(r.address))
    .filter(Boolean) as string[];

  return { catchAllMailboxIds, localPrefixes, domainFqdn };
}

export function domainFqdnFromPatternAddress(address: string): string | null {
  return domainFqdnFromCanonical(address);
}
