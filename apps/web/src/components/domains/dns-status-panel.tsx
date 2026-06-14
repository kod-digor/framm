"use client";

import { useT } from "@/i18n/t";
import {
  parseMxRecordValue,
  type DnsRecord,
  type DnsVerifyResult,
} from "@/lib/dns/dns-records";

type ValueTone = "neutral" | "success" | "error";

const valueToneClass: Record<ValueTone, string> = {
  neutral: "block break-all rounded bg-zinc-50 px-2 py-1 font-mono text-xs text-zinc-800",
  success:
    "block break-all rounded bg-green-50 px-2 py-1 font-mono text-xs text-green-900",
  error: "block break-all rounded bg-red-50 px-2 py-1 font-mono text-xs text-red-900",
};

function parseMxValue(value: string) {
  const parsed = parseMxRecordValue(value);
  return { priority: parsed.priority, host: parsed.target };
}

function DnsValueEntry({
  indexLabel,
  badge,
  badgeClassName,
  value,
  tone = "neutral",
  statusBadge,
}: {
  indexLabel: string;
  badge?: string;
  badgeClassName?: string;
  value: string;
  tone?: ValueTone;
  statusBadge?: string;
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
        {statusBadge && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
            {statusBadge}
          </span>
        )}
      </div>
      <code className={valueToneClass[tone]}>{value}</code>
    </li>
  );
}

function FoundValueEntry({
  value,
  ok,
  labels,
  issue,
}: {
  value: string;
  ok: boolean;
  labels: { found: string; nxdomain: string; none: string };
  issue: "NXDOMAIN" | "ENODATA" | null;
}) {
  const display =
    value === "—" || value === "NXDOMAIN"
      ? issue === "NXDOMAIN"
        ? labels.nxdomain
        : labels.none
      : value;

  return (
    <DnsValueEntry
      indexLabel={labels.found}
      value={display}
      tone={ok ? "success" : "error"}
    />
  );
}

function ExpectedValueList({
  record,
  labels,
}: {
  record: DnsRecord;
  labels: {
    mxRecordLabel: (index: number) => string;
    txtRecordLabel: (index: number) => string;
    txtSpfKind: string;
  };
}) {
  if (record.type === "MX") {
    const mx = parseMxValue(record.value);
    return (
      <ul className="flex flex-col gap-2">
        <DnsValueEntry
          indexLabel={labels.mxRecordLabel(1)}
          value={`${mx.priority} ${mx.host}`}
        />
      </ul>
    );
  }

  if (record.type === "TXT") {
    return (
      <ul className="flex flex-col gap-2">
        <DnsValueEntry
          indexLabel={labels.txtRecordLabel(1)}
          badge={labels.txtSpfKind}
          badgeClassName="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
          value={record.value}
        />
      </ul>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      <DnsValueEntry indexLabel={record.type} value={record.value} />
    </ul>
  );
}

export function DnsStatusPanel({
  check,
  mailHost,
}: {
  check: DnsVerifyResult;
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
          <div key={`${row.record.type}-${row.record.name}`}>
            <dt className="font-medium text-zinc-700">
              {row.record.type}
              {row.record.type === "CNAME" || row.record.type === "SRV" ? (
                <span className="ml-2 font-normal text-zinc-500">{row.record.name}</span>
              ) : null}
            </dt>
            <dd className="mt-1 space-y-3 text-zinc-600">
              <div className="space-y-2">
                <p className="text-zinc-500">{labels.expected} :</p>
                <ExpectedValueList record={row.record} labels={labels} />
              </div>

              {row.record.type === "MX" && row.mxRecords ? (
                <div className="space-y-2">
                  <p className="text-zinc-500">
                    {labels.mxFoundTitle(row.mxRecords.length)}
                  </p>
                  {row.mxRecords.length === 0 ? (
                    <ul className="flex flex-col gap-2">
                      <FoundValueEntry
                        value={row.found}
                        ok={row.ok}
                        labels={labels}
                        issue={row.issue}
                      />
                    </ul>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {row.mxRecords.map((entry, index) => (
                        <DnsValueEntry
                          key={`${entry.priority}-${entry.host}-${index}`}
                          indexLabel={labels.mxRecordLabel(index + 1)}
                          value={`${entry.priority} ${entry.host}`}
                          tone={entry.matchesExpected ? "success" : "neutral"}
                          statusBadge={
                            entry.matchesExpected
                              ? labels.matchesExpected
                              : undefined
                          }
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
                    <ul className="flex flex-col gap-2">
                      <FoundValueEntry
                        value={row.found}
                        ok={row.ok}
                        labels={labels}
                        issue={row.issue}
                      />
                    </ul>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {row.txtRecords.map((entry, index) => (
                        <DnsValueEntry
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
                          value={entry.value}
                          tone={entry.matchesExpected ? "success" : "neutral"}
                          statusBadge={
                            entry.matchesExpected
                              ? labels.matchesExpected
                              : undefined
                          }
                        />
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-zinc-500">{labels.txtSpfHint}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-zinc-500">{labels.found} :</p>
                  <ul className="flex flex-col gap-2">
                    <FoundValueEntry
                      value={row.found}
                      ok={row.ok}
                      labels={labels}
                      issue={row.issue}
                    />
                  </ul>
                </div>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
