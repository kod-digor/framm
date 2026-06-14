"use client";

import { useT } from "@/i18n/t";
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

function RecordEntry({
  indexLabel,
  badge,
  badgeClassName,
  matchesExpected,
  matchesLabel,
  value,
}: {
  indexLabel: string;
  badge?: string;
  badgeClassName?: string;
  matchesExpected: boolean;
  matchesLabel: string;
  value: string;
}) {
  return (
    <li className="rounded-md border border-zinc-200 bg-white p-2">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {indexLabel}
        </span>
        {badge && (
          <span
            className={
              badgeClassName ??
              "rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600"
            }
          >
            {badge}
          </span>
        )}
        {matchesExpected && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
            {matchesLabel}
          </span>
        )}
      </div>
      <code
        className={
          matchesExpected
            ? "block break-all rounded bg-green-50 px-2 py-1 font-mono text-xs text-green-900"
            : "block break-all rounded bg-zinc-50 px-2 py-1 font-mono text-xs text-zinc-800"
        }
      >
        {value}
      </code>
    </li>
  );
}

export function DnsStatusPanel({
  check,
  mailHost,
}: {
  check: DnsCheck;
  mailHost: string;
}) {
  const t = useT("domains");

  if (check.results.length === 0) return null;

  const labels = {
    title: t("dnsCurrentTitle"),
    expected: t("dnsExpected"),
    found: t("dnsFound"),
    nxdomain: t("dnsNxdomain"),
    none: t("dnsNone"),
    mxFoundTitle: (count: number) => t("dnsMxFoundTitle", { count }),
    mxRecordLabel: (index: number) => t("dnsMxRecordLabel", { index }),
    txtFoundTitle: (count: number) => t("dnsTxtFoundTitle", { count }),
    txtRecordLabel: (index: number) => t("dnsTxtRecordLabel", { index }),
    txtSpfKind: t("dnsTxtSpfKind"),
    txtOtherKind: t("dnsTxtOtherKind"),
    txtSpfHint: t("dnsTxtSpfHint", { mailHost }),
    matchesExpected: t("dnsMatchesExpected"),
  };

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

              {row.record.type === "MX" && row.mxRecords ? (
                <div className="space-y-2">
                  <p className="text-zinc-500">
                    {labels.mxFoundTitle(row.mxRecords.length)}
                  </p>
                  {row.mxRecords.length === 0 ? (
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
                    <ul className="flex flex-col gap-2">
                      {row.mxRecords.map((entry, index) => (
                        <RecordEntry
                          key={`${entry.priority}-${entry.host}-${index}`}
                          indexLabel={labels.mxRecordLabel(index + 1)}
                          matchesExpected={entry.matchesExpected}
                          matchesLabel={labels.matchesExpected}
                          value={`${entry.priority} ${entry.host}`}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              ) : row.record.type === "TXT" && row.txtRecords ? (
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
                    <ul className="flex flex-col gap-2">
                      {row.txtRecords.map((entry, index) => (
                        <RecordEntry
                          key={`${entry.kind}-${index}`}
                          indexLabel={labels.txtRecordLabel(index + 1)}
                          badge={
                            entry.kind === "spf"
                              ? labels.txtSpfKind
                              : labels.txtOtherKind
                          }
                          badgeClassName={
                            entry.kind === "spf"
                              ? "rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
                              : "rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600"
                          }
                          matchesExpected={entry.matchesExpected}
                          matchesLabel={labels.matchesExpected}
                          value={entry.value}
                        />
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
