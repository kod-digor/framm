"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatDnsHostLabel,
  parseMxRecordValue,
  parseSrvRecordValue,
  type DnsRecord,
} from "@/lib/dns/dns-records";

type Labels = {
  colType: string;
  colHost: string;
  colPriority: string;
  colValue: string;
  copy: string;
  copied: string;
  hostRootHint: string;
  srvValueHint: string;
};

function CopyButton({
  text,
  copyLabel,
  copiedLabel,
}: {
  text: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? copiedLabel : copyLabel}
    </Button>
  );
}

export function DnsRecordsTable({
  records,
  fqdn,
  labels,
}: {
  records: DnsRecord[];
  fqdn: string;
  labels: Labels;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
            <th className="px-4 py-3">{labels.colType}</th>
            <th className="px-4 py-3">{labels.colHost}</th>
            <th className="hidden px-4 py-3 sm:table-cell">{labels.colPriority}</th>
            <th className="px-4 py-3">{labels.colValue}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {records.map((record) => {
            const hostLabel = formatDnsHostLabel(record.name, fqdn);
            const isRoot = hostLabel === "@";
            const isMx = record.type === "MX";
            const isSrv = record.type === "SRV";
            const mx = isMx ? parseMxRecordValue(record.value) : null;
            const srv = isSrv ? parseSrvRecordValue(record.value) : null;
            const priority = isMx ? mx!.priority : isSrv ? srv!.priority : "—";
            const displayValue = isMx
              ? mx!.target
              : isSrv
                ? `${srv!.weight} ${srv!.port} ${srv!.target}`
                : record.value;
            const copyValue = isSrv ? record.value : displayValue;

            return (
              <tr key={`${record.type}-${record.name}`} className="bg-white">
                <td className="px-4 py-3 font-medium text-zinc-900">{record.type}</td>
                <td className="px-4 py-3">
                  <span className="font-mono text-zinc-800">{hostLabel}</span>
                  {isRoot && (
                    <p className="mt-0.5 text-xs text-zinc-500">{labels.hostRootHint}</p>
                  )}
                </td>
                <td className="hidden px-4 py-3 font-mono text-zinc-700 sm:table-cell">
                  {priority}
                </td>
                <td className="px-4 py-3">
                  <code className="break-all rounded bg-zinc-50 px-2 py-1 font-mono text-xs text-zinc-800">
                    {displayValue}
                  </code>
                  {isSrv && (
                    <p className="mt-1 text-xs text-zinc-500">{labels.srvValueHint}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <CopyButton
                    text={copyValue}
                    copyLabel={labels.copy}
                    copiedLabel={labels.copied}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
