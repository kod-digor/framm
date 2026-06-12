import { promises as dns } from "dns";

export type DnsRecord = { type: string; name: string; value: string };

export function expectedRecords(fqdn: string, mailHost: string): DnsRecord[] {
  return [
    { type: "MX", name: fqdn, value: `10 mail.${mailHost}.` },
    { type: "TXT", name: fqdn, value: "v=spf1 mx -all" },
  ];
}

export async function verifyDomainDns(fqdn: string, mailHost: string) {
  const expected = expectedRecords(fqdn, mailHost);
  const results: { record: DnsRecord; ok: boolean; found?: string }[] = [];

  for (const record of expected) {
    if (record.type === "MX") {
      const mx = await dns.resolveMx(fqdn).catch(() => []);
      const ok = mx.some((e) => e.exchange.includes("mail"));
      results.push({ record, ok, found: mx.map((m) => m.exchange).join(", ") });
    }
    if (record.type === "TXT") {
      const txt = await dns.resolveTxt(fqdn).catch(() => []);
      const flat = txt.map((t) => t.join("")).join(" ");
      const ok = flat.includes("spf1");
      results.push({ record, ok, found: flat });
    }
  }

  return {
    verified: results.every((r) => r.ok),
    results,
  };
}
