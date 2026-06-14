import { describe, expect, it } from "vitest";
import {
  localPartMatchesStalwartWildcard,
  matchesMailboxAddressPattern,
  parseAddressPatternInput,
  stalwartLocalWildcardIf,
} from "@/lib/mail/address-pattern";

describe("parseAddressPatternInput — wildcards alias", () => {
  it("parse igor.*@domaine.bzh en WILDCARD_LOCAL", () => {
    const result = parseAddressPatternInput("igor.*@domaine.bzh");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.parsed.patternType).toBe("WILDCARD_LOCAL");
    expect(result.parsed.canonical).toBe("igor.*@domaine.bzh");
    expect(result.parsed.localPrefix).toBe("igor");
  });

  it("parse *@domaine.bzh en WILDCARD_DOMAIN", () => {
    const result = parseAddressPatternInput("*@domaine.bzh");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.parsed.patternType).toBe("WILDCARD_DOMAIN");
    expect(result.parsed.canonical).toBe("*@domaine.bzh");
  });

  it("refuse les motifs trop larges", () => {
    expect(parseAddressPatternInput("*").ok).toBe(false);
    expect(parseAddressPatternInput("*@*").ok).toBe(false);
  });
});

describe("matchesMailboxAddressPattern — routage réception", () => {
  it("accepte une adresse exacte", () => {
    const parsed = parseAddressPatternInput("contact@domaine.bzh");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(matchesMailboxAddressPattern("contact@domaine.bzh", parsed.parsed)).toBe(true);
    expect(matchesMailboxAddressPattern("autre@domaine.bzh", parsed.parsed)).toBe(false);
  });

  it("route igor.* vers les adresses igor.xxx@domaine", () => {
    const parsed = parseAddressPatternInput("igor.*@domaine.bzh");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(matchesMailboxAddressPattern("igor.news@domaine.bzh", parsed.parsed)).toBe(true);
    expect(matchesMailboxAddressPattern("igor@domaine.bzh", parsed.parsed)).toBe(false);
    expect(matchesMailboxAddressPattern("alice.news@domaine.bzh", parsed.parsed)).toBe(false);
  });

  it("route *@domaine vers toute adresse du domaine", () => {
    const parsed = parseAddressPatternInput("*@domaine.bzh");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(matchesMailboxAddressPattern("quiconque@domaine.bzh", parsed.parsed)).toBe(true);
    expect(matchesMailboxAddressPattern("a.b@domaine.bzh", parsed.parsed)).toBe(true);
    expect(matchesMailboxAddressPattern("user@autre.bzh", parsed.parsed)).toBe(false);
  });

  it("est insensible à la casse", () => {
    const parsed = parseAddressPatternInput("Contact@Domaine.bzh");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(matchesMailboxAddressPattern("CONTACT@domaine.bzh", parsed.parsed)).toBe(true);
  });
});

describe("stalwartLocalWildcardIf — expression Stalwart", () => {
  it("génère une expression matches pour igor.*", () => {
    expect(stalwartLocalWildcardIf("igor")).toBe("matches('^igor\\\\..+$', rcpt)");
  });

  it("localPartMatchesStalwartWildcard reflète la même règle", () => {
    expect(localPartMatchesStalwartWildcard("igor.news", "igor")).toBe(true);
    expect(localPartMatchesStalwartWildcard("igor", "igor")).toBe(false);
    expect(localPartMatchesStalwartWildcard("alice.news", "igor")).toBe(false);
  });
});

describe("matchesMailboxAddressPattern — scénario boîte utilisateur", () => {
  it("simule la réception sur boîte avec alias exact et wildcard local", () => {
    const mailboxAddress = "alice@domaine.bzh";
    const patterns = [
      parseAddressPatternInput("contact@domaine.bzh"),
      parseAddressPatternInput("igor.*@domaine.bzh"),
    ].flatMap((r) => (r.ok ? [r.parsed] : []));

    const incoming = [
      "contact@domaine.bzh",
      "igor.support@domaine.bzh",
      "spam@domaine.bzh",
      mailboxAddress,
    ];

    const routed = incoming.map((email) =>
      patterns.some((pattern) => matchesMailboxAddressPattern(email, pattern))
    );

    expect(routed).toEqual([true, true, false, false]);
  });
});
