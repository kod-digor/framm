import type { verifyDomainDns } from "@/lib/dns/verify";

type DnsCheck = Awaited<ReturnType<typeof verifyDomainDns>>;

function FoundValue({
  value,
  ok,
  labels,
  issue,
}: {
  value: string;
  ok: boolean;
  labels: { nxdomain: string; none: string };
  issue: "NXDOMAIN" | "ENODATA" | null;
}) {
  const display =
    value === "—" || value === "NXDOMAIN"
      ? issue === "NXDOMAIN"
        ? labels.nxdomain
        : labels.none
      : value;

  return (
    <code
      className={
        ok
          ? "rounded bg-green-100 px-1.5 py-0.5 font-mono text-xs text-green-800"
          : "rounded bg-red-100 px-1.5 py-0.5 font-mono text-xs text-red-800"
      }
    >
      {display}
    </code>
  );
}

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
    txtFoundTitle: (count: number) => string;
    txtSpfKind: string;
    txtOtherKind: string;
    txtSpfHint: string;
    txtMatchesExpected: string;
  };
}) {
  if (check.results.length === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">
      <h4 className="font-medium text-zinc-900">{labels.title}</h4>
      {!check.domainExists && (
        <p className="mt-2 text-red-700">{labels.nxdomain}</p>
      )}
      <dl className="mt-3 space-y-4">
        {check.results.map((row) => (
          <div key={row.record.type}>
            <dt className="font-medium text-zinc-700">{row.record.type}</dt>
            <dd className="mt-1 space-y-2 text-zinc-600">
              <p>
                <span className="text-zinc-500">{labels.expected} :</span>{" "}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">
                  {row.record.value}
                </code>
              </p>

              {row.record.type === "TXT" && row.txtRecords ? (
                <div className="space-y-2">
                  <p className="text-zinc-500">
                    {labels.txtFoundTitle(row.txtRecords.length)}
                  </p>
                  {row.txtRecords.length === 0 ? (
                    <p>
                      <span className="text-zinc-500">{labels.found} :</span>{" "}
                      <FoundValue
                        value={row.found}
                        ok={row.ok}
                        labels={labels}
                        issue={row.issue}
                      />
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {row.txtRecords.map((entry, index) => (
                        <li
                          key={`${entry.kind}-${index}`}
                          className="rounded-md border border-zinc-200 bg-white p-2"
                        >
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                              TXT {index + 1}
                            </span>
                            <span
                              className={
                                entry.kind === "spf"
                                  ? "rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
                                  : "rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600"
                              }
                            >
                              {entry.kind === "spf"
                                ? labels.txtSpfKind
                                : labels.txtOtherKind}
                            </span>
                            {entry.matchesExpected && (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                {labels.txtMatchesExpected}
                              </span>
                            )}
                          </div>
                          <code
                            className={
                              entry.matchesExpected
                                ? "block break-all rounded bg-green-50 px-2 py-1 font-mono text-xs text-green-900"
                                : "block break-all rounded bg-zinc-50 px-2 py-1 font-mono text-xs text-zinc-800"
                            }
                          >
                            {entry.value}
                          </code>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-zinc-500">{labels.txtSpfHint}</p>
                </div>
              ) : (
                <p>
                  <span className="text-zinc-500">{labels.found} :</span>{" "}
                  <FoundValue
                    value={row.found}
                    ok={row.ok}
                    labels={labels}
                    issue={row.issue}
                  />
                </p>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
