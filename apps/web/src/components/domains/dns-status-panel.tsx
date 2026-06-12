import type { verifyDomainDns } from "@/lib/dns/verify";

type DnsCheck = Awaited<ReturnType<typeof verifyDomainDns>>;

export function DnsStatusPanel({
  check,
  labels,
}: {
  check: DnsCheck;
  labels: {
    title: string;
    expected: string;
    found: string;
    nxdomain: string;
    none: string;
  };
}) {
  if (check.results.length === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">
      <h4 className="font-medium text-zinc-900">{labels.title}</h4>
      {!check.domainExists && (
        <p className="mt-2 text-red-700">{labels.nxdomain}</p>
      )}
      <dl className="mt-3 space-y-2">
        {check.results.map((row) => (
          <div key={row.record.type}>
            <dt className="font-medium text-zinc-700">{row.record.type}</dt>
            <dd className="mt-1 space-y-1 text-zinc-600">
              <p>
                <span className="text-zinc-500">{labels.expected} :</span>{" "}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">
                  {row.record.value}
                </code>
              </p>
              <p>
                <span className="text-zinc-500">{labels.found} :</span>{" "}
                <code
                  className={
                    row.ok
                      ? "rounded bg-green-100 px-1.5 py-0.5 font-mono text-xs text-green-800"
                      : "rounded bg-red-100 px-1.5 py-0.5 font-mono text-xs text-red-800"
                  }
                >
                  {row.found === "—" || row.found === "NXDOMAIN"
                    ? row.issue === "NXDOMAIN"
                      ? labels.nxdomain
                      : labels.none
                    : row.found}
                </code>
              </p>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
