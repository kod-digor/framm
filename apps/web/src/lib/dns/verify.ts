import { Resolver } from "node:dns/promises";
import {
  type DnsCheckRow,
  type DnsLookupIssue,
  type DnsVerifyResult,
  expectedRecords,
  getPlatformApexSpfIncludeTokens,
  getPlatformMailHost,
  isPlatformDomain,
  mailAutoconfigTarget,
} from "@/lib/dns/dns-records";

/** Résolveur fiable pour les checks prod (CoreDNS / resolver OS peut renvoyer ENODATA sur SRV). */
const PLATFORM_DNS_SERVERS = ["8.8.8.8", "1.1.1.1"];

function createPlatformDnsResolver() {
  const resolver = new Resolver();
  resolver.setServers(PLATFORM_DNS_SERVERS);
  return resolver;
}

export type {
  DnsCheckRow,
  DnsLookupIssue,
  DnsRecord,
  DnsVerifyResult,
  MxRecordFinding,
  TxtRecordFinding,
} from "@/lib/dns/dns-records";

export {
  expectedRecords,
  formatDnsHostLabel,
  getExpectedSpfValue,
  getPlatformApexSpfIncludeTokens,
  getPlatformMailHost,
  isPlatformDomain,
  mailAutoconfigTarget,
  parseMxRecordValue,
  parseSrvRecordValue,
} from "@/lib/dns/dns-records";

function isSpfTxt(value: string) {
  return value.trim().toLowerCase().startsWith("v=spf1");
}

function spfMatchesExpected(value: string, platformHost: string, platformApex = false) {
  const lower = value.toLowerCase();
  if (platformApex) {
    return getPlatformApexSpfIncludeTokens(platformHost).some((token) => lower.includes(token));
  }
  return lower.includes(`include:spf.${platformHost.toLowerCase()}`);
}

function normalizeHost(host: string) {
  return host.replace(/\.$/, "").toLowerCase();
}

function formatLookupError(code: string | undefined) {
  if (code === "ENOTFOUND" || code === "ENODATA") return code as "NXDOMAIN" | "ENODATA";
  return null;
}

function formatFoundValue(entries: string[], issue: "NXDOMAIN" | "ENODATA" | null) {
  if (entries.length > 0) return entries.join(", ");
  if (issue === "NXDOMAIN") return "NXDOMAIN";
  if (issue === "ENODATA") return "—";
  return "—";
}

function normalizeCnameTarget(target: string) {
  return target.replace(/\.$/, "").toLowerCase();
}

function formatSrvRecord(entry: { priority: number; weight: number; port: number; name: string }) {
  return `${entry.priority} ${entry.weight} ${entry.port} ${entry.name}`;
}

export type PlatformARecordCheck = {
  host: string;
  label: string;
  ok: boolean;
  addresses: string[];
  issue: DnsLookupIssue;
};

async function resolveARecords(host: string): Promise<{ addresses: string[]; issue: DnsLookupIssue }> {
  const resolver = createPlatformDnsResolver();
  try {
    const addresses = await resolver.resolve4(host);
    return { addresses, issue: null };
  } catch (err) {
    const issue = formatLookupError((err as NodeJS.ErrnoException).code);
    return { addresses: [], issue };
  }
}

async function verifyDnsRecordsForDomain(
  fqdn: string,
  platformHost: string
): Promise<{ domainExists: boolean; results: DnsCheckRow[] }> {
  const expected = expectedRecords(fqdn, platformHost);
  const expectedMx = normalizeHost(`mail.${platformHost}`);
  const expectedCname = normalizeCnameTarget(mailAutoconfigTarget(platformHost));
  const platformApex = fqdn.toLowerCase() === platformHost.toLowerCase();
  const resolver = createPlatformDnsResolver();
  const results: DnsCheckRow[] = [];

  let domainExists = true;

  for (const record of expected) {
    if (record.type === "MX") {
      let mx: { exchange: string; priority: number }[] = [];
      let issue: "NXDOMAIN" | "ENODATA" | null = null;
      try {
        mx = await resolver.resolveMx(fqdn);
      } catch (err) {
        issue = formatLookupError((err as NodeJS.ErrnoException).code);
        if (issue === "NXDOMAIN") domainExists = false;
      }
      const mxRecords = mx.map((m) => ({
        priority: m.priority ?? 10,
        host: m.exchange,
        matchesExpected: normalizeHost(m.exchange) === expectedMx,
      }));
      const ok = mxRecords.some((entry) => entry.matchesExpected);
      results.push({
        record,
        ok,
        issue,
        mxRecords,
        found: formatFoundValue(
          mxRecords.map((m) => `${m.priority} ${m.host}`),
          issue
        ),
      });
    }
    if (record.type === "TXT") {
      let txt: string[][] = [];
      let issue: "NXDOMAIN" | "ENODATA" | null = null;
      try {
        txt = await resolver.resolveTxt(fqdn);
      } catch (err) {
        issue = formatLookupError((err as NodeJS.ErrnoException).code);
        if (issue === "NXDOMAIN") domainExists = false;
      }
      const entries = txt.map((chunks) => chunks.join(""));
      const txtRecords = entries.map((value) => ({
        value,
        kind: isSpfTxt(value) ? ("spf" as const) : ("other" as const),
        matchesExpected:
          isSpfTxt(value) && spfMatchesExpected(value, platformHost, platformApex),
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
    if (record.type === "CNAME") {
      let cnames: string[] = [];
      let issue: "NXDOMAIN" | "ENODATA" | null = null;
      try {
        cnames = await resolver.resolveCname(record.name);
      } catch (err) {
        issue = formatLookupError((err as NodeJS.ErrnoException).code);
        if (issue === "NXDOMAIN") domainExists = false;
      }
      const ok = cnames.some((c) => normalizeCnameTarget(c) === expectedCname);
      results.push({
        record,
        ok,
        issue,
        found: formatFoundValue(cnames, issue),
      });
    }
    if (record.type === "SRV") {
      let srv: { priority: number; weight: number; port: number; name: string }[] = [];
      let issue: "NXDOMAIN" | "ENODATA" | null = null;
      try {
        srv = await resolver.resolveSrv(record.name);
      } catch (err) {
        issue = formatLookupError((err as NodeJS.ErrnoException).code);
        if (issue === "NXDOMAIN") domainExists = false;
      }
      const ok = srv.some(
        (entry) =>
          entry.port === (record.name.startsWith("_imaps") ? 993 : 587) &&
          normalizeHost(entry.name) === expectedMx
      );
      results.push({
        record,
        ok,
        issue,
        found: formatFoundValue(srv.map(formatSrvRecord), issue),
      });
    }
  }

  return { domainExists, results };
}

export async function verifyPlatformARecords(domain?: string): Promise<PlatformARecordCheck[]> {
  const fqdn = domain ?? getPlatformMailHost();
  const entries = [
    { host: fqdn, label: "@" },
    { host: `mail.${fqdn}`, label: "mail" },
    { host: `webmail.${fqdn}`, label: "webmail" },
  ];

  const checks = await Promise.all(
    entries.map(async ({ host, label }) => {
      const { addresses, issue } = await resolveARecords(host);
      return {
        host,
        label,
        ok: addresses.length > 0,
        addresses,
        issue,
      };
    })
  );

  return checks;
}

export async function verifyDomainDns(fqdn: string, mailHost?: string): Promise<DnsVerifyResult> {
  const platformHost = mailHost ?? getPlatformMailHost();

  if (isPlatformDomain(fqdn)) {
    return { verified: true, domainExists: true, results: [] };
  }

  const { domainExists, results } = await verifyDnsRecordsForDomain(fqdn, platformHost);
  return {
    verified: results.every((r) => r.ok),
    domainExists,
    results,
  };
}

export async function verifyPlatformDns(domain?: string): Promise<DnsVerifyResult> {
  const fqdn = domain ?? getPlatformMailHost();
  const { domainExists, results } = await verifyDnsRecordsForDomain(fqdn, fqdn);
  return {
    verified: results.every((r) => r.ok),
    domainExists,
    results,
  };
}
