import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deprovisionMailboxAddressPattern,
  provisionMailboxAddressPattern,
} from "@/lib/mail/mailbox-address-provision";
import { parseAddressPatternInput } from "@/lib/mail/address-pattern";

vi.mock("@/lib/stalwart/client", () => ({
  addAccountEmailAlias: vi.fn(),
  createMailingListWithRecipients: vi.fn(),
  deleteAlias: vi.fn(async () => ({ methodResponses: [] })),
  extractDomainCatchAllAddress: vi.fn(),
  extractDomainSubAddressingRule: vi.fn(),
  extractStalwartCreatedId: vi.fn(() => "ml-created"),
  getDomain: vi.fn(),
  isStalwartFailure: vi.fn((res: unknown) => {
    if (typeof res === "object" && res !== null && ("unavailable" in res || "error" in res)) {
      return true;
    }
    return false;
  }),
  resetDomainSubAddressingEnabled: vi.fn(),
  resolveEmailAliasStalwartId: vi.fn(async () => ({ id: "ml-old", unavailable: false })),
  updateDomainCatchAll: vi.fn(),
  updateDomainSubAddressingCustom: vi.fn(),
}));

vi.mock("@/lib/mail/mailbox-send-identities", () => ({
  syncExactAliasSendIdentity: vi.fn(async () => true),
  removeExactAliasSendIdentity: vi.fn(async () => true),
}));

import {
  addAccountEmailAlias,
  createMailingListWithRecipients,
  extractDomainCatchAllAddress,
  extractDomainSubAddressingRule,
  getDomain,
  updateDomainCatchAll,
  updateDomainSubAddressingCustom,
} from "@/lib/stalwart/client";
import {
  removeExactAliasSendIdentity,
  syncExactAliasSendIdentity,
} from "@/lib/mail/mailbox-send-identities";

describe("provisionMailboxAddressPattern — alias wildcard et exact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(addAccountEmailAlias).mockResolvedValue({ methodResponses: [] });
    vi.mocked(createMailingListWithRecipients).mockResolvedValue({ methodResponses: [] });
    vi.mocked(getDomain).mockResolvedValue({ methodResponses: [] });
    vi.mocked(extractDomainCatchAllAddress).mockReturnValue(null);
    vi.mocked(extractDomainSubAddressingRule).mockReturnValue(null);
    vi.mocked(updateDomainCatchAll).mockResolvedValue({ methodResponses: [] });
    vi.mocked(updateDomainSubAddressingCustom).mockResolvedValue({ methodResponses: [] });
  });

  it("provisionne un alias exact via alias de compte + identité d'envoi", async () => {
    const parsed = parseAddressPatternInput("contact@domaine.bzh");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const result = await provisionMailboxAddressPattern({
      parsed: parsed.parsed,
      mailboxAddress: "alice@domaine.bzh",
      stalwartDomainId: "dom-1",
      stalwartAccountId: "acc-1",
      mailboxDisplayName: "Alice",
    });

    expect(result).toEqual({ stalwartAliasId: null });
    expect(addAccountEmailAlias).toHaveBeenCalledWith(
      "acc-1",
      "contact@domaine.bzh",
      "dom-1"
    );
    expect(syncExactAliasSendIdentity).toHaveBeenCalledWith({
      stalwartAccountId: "acc-1",
      aliasEmail: "contact@domaine.bzh",
      stalwartDomainId: "dom-1",
      displayName: "Alice",
    });
    expect(createMailingListWithRecipients).not.toHaveBeenCalled();
  });

  it("provisionne igor.* via règle sub-addressing Stalwart", async () => {
    const parsed = parseAddressPatternInput("igor.*@domaine.bzh");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const result = await provisionMailboxAddressPattern({
      parsed: parsed.parsed,
      mailboxAddress: "alice@domaine.bzh",
      stalwartDomainId: "dom-1",
    });

    expect(result).toEqual({ stalwartAliasId: null });
    expect(getDomain).toHaveBeenCalledWith("dom-1");
    expect(updateDomainSubAddressingCustom).toHaveBeenCalledWith("dom-1", {
      match: [{ if: "matches('^igor\\\\..+$', rcpt)", then: "alice" }],
      else: "rcpt",
    });
  });

  it("provisionne *@domaine via catch-all domaine", async () => {
    const parsed = parseAddressPatternInput("*@domaine.bzh");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const result = await provisionMailboxAddressPattern({
      parsed: parsed.parsed,
      mailboxAddress: "alice@domaine.bzh",
      stalwartDomainId: "dom-1",
    });

    expect(result).toEqual({ stalwartAliasId: null });
    expect(updateDomainCatchAll).toHaveBeenCalledWith("dom-1", "alice@domaine.bzh");
  });

  it("retire alias exact via identité d'envoi et mailing list legacy", async () => {
    const ok = await deprovisionMailboxAddressPattern({
      patternType: "EXACT",
      address: "contact@domaine.bzh",
      mailboxAddress: "alice@domaine.bzh",
      stalwartDomainId: "dom-1",
      stalwartAccountId: "acc-1",
      stalwartAliasId: "ml-old",
    });

    expect(ok).toBe(true);
    expect(removeExactAliasSendIdentity).toHaveBeenCalledWith({
      stalwartAccountId: "acc-1",
      aliasEmail: "contact@domaine.bzh",
      stalwartDomainId: "dom-1",
    });
  });
});
