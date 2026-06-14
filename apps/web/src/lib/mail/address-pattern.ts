import type { MailboxAddressPatternType } from "@prisma/client";

export type ParsedAddressPattern = {
  patternType: MailboxAddressPatternType;
  /** Valeur stockée en base (minuscules). */
  canonical: string;
  domainFqdn: string;
  /** Préfixe local pour WILDCARD_LOCAL (ex. igor pour igor.*). */
  localPrefix?: string;
};

export type AddressPatternErrorCode =
  | "invalid"
  | "domainMismatch"
  | "dangerousPattern"
  | "sameAsPrimary";

const LOCAL_PART_CHARS = /^[a-z0-9][a-z0-9._+-]*$/;
const WILDCARD_LOCAL_RE = /^([a-z0-9][a-z0-9._+-]*)\.\*$/i;

function normalizeFqdn(fqdn: string): string {
  return fqdn.trim().toLowerCase();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidExactLocalPart(local: string): boolean {
  return local.length > 0 && LOCAL_PART_CHARS.test(local);
}

/** Parse une saisie utilisateur en motif ou adresse exacte. */
export function parseAddressPatternInput(
  rawInput: string,
  fallbackDomainFqdn?: string
):
  | { ok: true; parsed: ParsedAddressPattern }
  | { ok: false; code: AddressPatternErrorCode } {
  const input = rawInput.trim().toLowerCase();
  if (!input) return { ok: false, code: "invalid" };

  if (input === "*" || input === "*.*" || input === "*@*" || input.startsWith("*.*@")) {
    return { ok: false, code: "dangerousPattern" };
  }

  if (input.startsWith("*@")) {
    const domainFqdn = normalizeFqdn(input.slice(2));
    if (!domainFqdn || domainFqdn.includes("*")) {
      return { ok: false, code: "invalid" };
    }
    return {
      ok: true,
      parsed: {
        patternType: "WILDCARD_DOMAIN",
        canonical: `*@${domainFqdn}`,
        domainFqdn,
      },
    };
  }

  if (input.includes("@")) {
    const at = input.lastIndexOf("@");
    const local = input.slice(0, at);
    const domainFqdn = normalizeFqdn(input.slice(at + 1));

    if (!domainFqdn || domainFqdn.includes("*")) {
      return { ok: false, code: "invalid" };
    }

    const wildcardMatch = local.match(WILDCARD_LOCAL_RE);
    if (wildcardMatch) {
      const prefix = wildcardMatch[1].toLowerCase();
      return {
        ok: true,
        parsed: {
          patternType: "WILDCARD_LOCAL",
          canonical: `${prefix}.*@${domainFqdn}`,
          domainFqdn,
          localPrefix: prefix,
        },
      };
    }

    if (local.includes("*")) {
      return { ok: false, code: "invalid" };
    }

    if (!isValidExactLocalPart(local)) {
      return { ok: false, code: "invalid" };
    }

    return {
      ok: true,
      parsed: {
        patternType: "EXACT",
        canonical: `${local}@${domainFqdn}`,
        domainFqdn,
      },
    };
  }

  const wildcardOnly = input.match(WILDCARD_LOCAL_RE);
  if (wildcardOnly) {
    if (!fallbackDomainFqdn) return { ok: false, code: "invalid" };
    const domainFqdn = normalizeFqdn(fallbackDomainFqdn);
    const prefix = wildcardOnly[1].toLowerCase();
    return {
      ok: true,
      parsed: {
        patternType: "WILDCARD_LOCAL",
        canonical: `${prefix}.*@${domainFqdn}`,
        domainFqdn,
        localPrefix: prefix,
      },
    };
  }

  if (input.includes("*")) {
    return { ok: false, code: "invalid" };
  }

  if (!fallbackDomainFqdn || !isValidExactLocalPart(input)) {
    return { ok: false, code: "invalid" };
  }

  const domainFqdn = normalizeFqdn(fallbackDomainFqdn);
  return {
    ok: true,
    parsed: {
      patternType: "EXACT",
      canonical: `${input}@${domainFqdn}`,
      domainFqdn,
    },
  };
}

/** Vérifie que le domaine appartient à l'organisation. */
export function validatePatternDomain(
  parsed: ParsedAddressPattern,
  orgDomainFqdns: string[]
): { ok: true } | { ok: false; code: AddressPatternErrorCode } {
  if (!orgDomainFqdns.map(normalizeFqdn).includes(parsed.domainFqdn)) {
    return { ok: false, code: "domainMismatch" };
  }
  return { ok: true };
}

export function isSameAsPrimary(parsed: ParsedAddressPattern, primaryAddress: string): boolean {
  return parsed.patternType === "EXACT" && parsed.canonical === normalizeEmail(primaryAddress);
}

/** Expression Stalwart (partie locale) pour un motif prefix.* */
export function stalwartLocalWildcardIf(localPrefix: string): string {
  const escaped = localPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return `matches('^${escaped}\\\\..+$', rcpt)`;
}

export function isBroadDomainCatchAll(parsed: ParsedAddressPattern): boolean {
  return parsed.patternType === "WILDCARD_DOMAIN";
}

export function localPrefixFromCanonical(address: string): string | null {
  const match = address.match(/^([a-z0-9][a-z0-9._+-]*)\.\*@/);
  return match?.[1] ?? null;
}

export function domainFqdnFromCanonical(address: string): string | null {
  const at = address.lastIndexOf("@");
  if (at < 0) return null;
  return address.slice(at + 1);
}

function normalizeRecipientEmail(email: string): string | null {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) return null;
  return normalized;
}

/** Vérifie si une adresse destinataire correspond à un motif MailboxAddress. */
export function matchesMailboxAddressPattern(
  recipientEmail: string,
  pattern: Pick<ParsedAddressPattern, "patternType" | "canonical" | "domainFqdn" | "localPrefix">
): boolean {
  const recipient = normalizeRecipientEmail(recipientEmail);
  if (!recipient) return false;

  if (pattern.patternType === "EXACT") {
    return recipient === pattern.canonical;
  }

  const at = recipient.lastIndexOf("@");
  const local = recipient.slice(0, at);
  const domain = recipient.slice(at + 1);

  if (pattern.patternType === "WILDCARD_DOMAIN") {
    return domain === pattern.domainFqdn;
  }

  if (pattern.patternType === "WILDCARD_LOCAL" && pattern.localPrefix) {
    return domain === pattern.domainFqdn && localPartMatchesStalwartWildcard(local, pattern.localPrefix);
  }

  return false;
}

/** Évalue la règle Stalwart `matches('^prefix\\..+$', rcpt)` sur la partie locale. */
export function localPartMatchesStalwartWildcard(localPart: string, localPrefix: string): boolean {
  const escaped = localPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}\\..+$`, "i").test(localPart);
}
