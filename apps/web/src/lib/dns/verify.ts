import { promises as dns } from "dns";

export type DnsRecord = { type: string; name: string; value: string };

export type TxtRecordFinding = {
  value: string;
  kind: "spf" | "other";
  matchesExpected: boolean;
};

export type DnsCheckRow = {
  record: DnsRecord;
  ok: boolean;
  found: string;
  issue: DnsLookupIssue;
  txtRecords?: TxtRecordFinding[];
};

export function getPlatformMailHost() {
  return (
    process.env.PRIMARY_PLATFORM_DOMAIN ??
    process.env.PRIMARY_MAIL_HOST ??
    "kod-digor.bzh"
  );
}

export function getExpectedSpfValue(platformHost?: string) {
  const host = platformHost ?? getPlatformMailHost();
  return `v=spf1 include:spf.${host} -all`;
}

function getSpfIncludeToken(platformHost: string) {
  return `include:spf.${platformHost}`.toLowerCase();
}

function isSpfTxt(value: string) {
  return value.trim().toLowerCase().startsWith("v=spf1");
}

function spfMatchesExpected(value: string, platformHost: string) {
  return value.toLowerCase().includes(getSpfIncludeToken(platformHost));
}

export function expectedRecords(fqdn: string, mailHost?: string): DnsRecord[] {
  const platformHost = mailHost ?? getPlatformMailHost();
  return [
    { type: "MX", name: fqdn, value: `10 mail.${platformHost}.` },
    { type: "TXT", name: fqdn, value: getExpectedSpfValue(platformHost) },
  ];
}

export function isPlatformDomain(fqdn: string) {
  return fqdn.toLowerCase() === getPlatformMailHost().toLowerCase();
}

function normalizeHost(host: string) {
  return host.replace(/\.$/, "").toLowerCase();
}

type DnsLookupIssue = "NXDOMAIN" | "ENODATA" | null;

function formatLookupError(code: string | undefined) {
  if (code === "ENOTFOUND" || code === "ENODATA") return code as DnsLookupIssue;
  return null;
}

function formatFoundValue(entries: string[], issue: DnsLookupIssue) {
  if (entries.length > 0) return entries.join(", ");
  if (issue === "NXDOMAIN") return "NXDOMAIN";
  if (issue === "ENODATA") return "—";
  return "—";
}

export async function verifyDomainDns(fqdn: string, mailHost?: string) {
  const platformHost = mailHost ?? getPlatformMailHost();

  if (isPlatformDomain(fqdn)) {
    return { verified: true, domainExists: true, results: [] };
  }

  const expected = expectedRecords(fqdn, platformHost);
  const expectedMx = normalizeHost(`mail.${platformHost}`);
  const results: DnsCheckRow[] = [];

  let domainExists = true;

  for (const record of expected) {
    if (record.type === "MX") {
      let mx: { exchange: string; priority: number }[] = [];
      let issue: DnsLookupIssue = null;
      try {
        mx = await dns.resolveMx(fqdn);
      } catch (err) {
        issue = formatLookupError((err as NodeJS.ErrnoException).code);
        if (issue === "NXDOMAIN") domainExists = false;
      }
      const ok = mx.some((e) => normalizeHost(e.exchange) === expectedMx);
      results.push({
        record,
        ok,
        issue,
        found: formatFoundValue(
          mx.map((m) => `${m.priority ?? 10} ${m.exchange}`),
          issue
        ),
      });
    }
    if (record.type === "TXT") {
      let txt: string[][] = [];
      let issue: DnsLookupIssue = null;
      try {
        txt = await dns.resolveTxt(fqdn);
      } catch (err) {
        issue = formatLookupError((err as NodeJS.ErrnoException).code);
        if (issue === "NXDOMAIN") domainExists = false;
      }
      const entries = txt.map((chunks) => chunks.join(""));
      const txtRecords = entries.map((value) => ({
        value,
        kind: isSpfTxt(value) ? ("spf" as const) : ("other" as const),
        matchesExpected:
          isSpfTxt(value) && spfMatchesExpected(value, platformHost),
      }));
      const ok = txtRecords.some((entry) => entry.matchesExpected);
      results.push({
        record,
        ok,
        issue,
        txtRecords,
        found: formatFoundValue(entries, issue),
      });
    }
  }

  return {
    verified: results.every((r) => r.ok),
    domainExists,
    results,
  };
}
