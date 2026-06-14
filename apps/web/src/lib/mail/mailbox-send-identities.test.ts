import { describe, expect, it } from "vitest";
import { resolveMailboxSendAddresses } from "@/lib/mail/mailbox-send-identities";

describe("resolveMailboxSendAddresses — choix expéditeur", () => {
  it("inclut l'adresse principale et les alias exacts sendables", () => {
    const addresses = resolveMailboxSendAddresses({
      primaryAddress: "alice@domaine.bzh",
      alternateAddresses: [
        { address: "contact@domaine.bzh", patternType: "EXACT" },
        { address: "igor.*@domaine.bzh", patternType: "WILDCARD_LOCAL" },
        { address: "*@domaine.bzh", patternType: "WILDCARD_DOMAIN" },
      ],
    });

    expect(addresses).toEqual([
      {
        email: "alice@domaine.bzh",
        sendable: true,
        patternType: "EXACT",
        labelKey: "primaryAddress",
      },
      {
        email: "contact@domaine.bzh",
        sendable: true,
        patternType: "EXACT",
        labelKey: "exactAlias",
      },
      {
        email: "igor.*@domaine.bzh",
        sendable: false,
        patternType: "WILDCARD_LOCAL",
        labelKey: "wildcardLocalPattern",
      },
      {
        email: "*@domaine.bzh",
        sendable: false,
        patternType: "WILDCARD_DOMAIN",
        labelKey: "wildcardDomainPattern",
      },
    ]);
  });
});
