import type { OrganizationStatus } from "@prisma/client";
import { approveOrganization, rejectOrganizationForm } from "@/app/actions/bureau";
import { OrgStatusBadge } from "@/components/bureau/org-status-badge";
import { Button } from "@/components/ui/button";
import { formatEur } from "@/lib/billing/pricing";
import type { BureauOrgRow } from "@/lib/bureau/load-orgs";
import { formatBytes } from "@/lib/utils";

export type BureauOrgListLabels = {
  colName: string;
  colStatus: string;
  colAdmin: string;
  colCreated: string;
  colMailboxes: string;
  colDomains: string;
  colStorage: string;
  colCost: string;
  colWallet: string;
  colActions: string;
  approve: string;
  reject: string;
  rejectReason: string;
  statusLabel: (status: OrganizationStatus) => string;
};

function formatDate(date: Date) {
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function OrgPendingActions({
  orgId,
  labels,
}: {
  orgId: string;
  labels: Pick<BureauOrgListLabels, "approve" | "reject" | "rejectReason">;
}) {
  return (
    <div className="flex flex-col gap-3">
      <form action={approveOrganization.bind(null, orgId)}>
        <Button type="submit" className="min-h-11 w-full md:min-h-0 md:h-8 md:text-sm">
          {labels.approve}
        </Button>
      </form>
      <form action={rejectOrganizationForm.bind(null, orgId)} className="flex flex-col gap-2">
        <input
          name="reason"
          placeholder={labels.rejectReason}
          className="min-h-11 rounded-md border border-zinc-200 px-3 py-2 text-sm md:min-h-0 md:px-2 md:py-1 md:text-xs"
        />
        <Button
          type="submit"
          variant="destructive"
          className="min-h-11 w-full md:min-h-0 md:h-8 md:text-sm"
        >
          {labels.reject}
        </Button>
      </form>
    </div>
  );
}

function OrgMetric({
  label,
  value,
  emphasized,
}: {
  label: string;
  value: React.ReactNode;
  emphasized?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd
        className={
          emphasized
            ? "mt-0.5 text-sm font-medium text-zinc-900"
            : "mt-0.5 text-sm text-zinc-700"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function OrgMobileCard({ org, labels }: { org: BureauOrgRow; labels: BureauOrgListLabels }) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium text-zinc-900">{org.name}</h3>
          <p className="text-xs text-zinc-500">{org.slug}</p>
        </div>
        <OrgStatusBadge status={org.status} label={labels.statusLabel(org.status)} />
      </div>

      {org.status === "PENDING" && org.presentation && (
        <p className="mt-3 text-sm text-zinc-600 line-clamp-3">{org.presentation}</p>
      )}
      {org.status === "REJECTED" && org.rejectReason && (
        <p className="mt-3 text-sm text-red-600">{org.rejectReason}</p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <OrgMetric label={labels.colAdmin} value={org.adminEmail ?? "—"} />
        <OrgMetric label={labels.colCreated} value={formatDate(org.createdAt)} />
        <OrgMetric label={labels.colMailboxes} value={org.mailboxCount} />
        <OrgMetric label={labels.colDomains} value={org.domainCount} />
        <OrgMetric label={labels.colStorage} value={formatBytes(org.storageBytes)} emphasized />
        <OrgMetric
          label={labels.colCost}
          value={org.monthlyCostEur != null ? formatEur(org.monthlyCostEur) : "—"}
        />
        {org.status === "APPROVED" && (
          <OrgMetric label={labels.colWallet} value={formatEur(org.walletBalanceCents / 100)} emphasized />
        )}
      </dl>

      {org.status === "PENDING" && (
        <div className="mt-4 border-t border-zinc-100 pt-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
            {labels.colActions}
          </p>
          <OrgPendingActions orgId={org.id} labels={labels} />
        </div>
      )}
    </article>
  );
}

export function BureauOrgList({ orgs, labels }: { orgs: BureauOrgRow[]; labels: BureauOrgListLabels }) {
  return (
    <>
      <div className="space-y-4 md:hidden">
        {orgs.map((org) => (
          <OrgMobileCard key={org.id} org={org} labels={labels} />
        ))}
      </div>

      <div className="hidden md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-zinc-500">
              <th className="pb-2 pr-4 font-medium">{labels.colName}</th>
              <th className="pb-2 pr-4 font-medium">{labels.colStatus}</th>
              <th className="pb-2 pr-4 font-medium">{labels.colAdmin}</th>
              <th className="pb-2 pr-4 font-medium">{labels.colCreated}</th>
              <th className="pb-2 pr-4 font-medium">{labels.colMailboxes}</th>
              <th className="pb-2 pr-4 font-medium">{labels.colDomains}</th>
              <th className="pb-2 pr-4 font-medium">{labels.colStorage}</th>
              <th className="pb-2 pr-4 font-medium">{labels.colCost}</th>
              <th className="pb-2 pr-4 font-medium">{labels.colWallet}</th>
              <th className="pb-2 font-medium">{labels.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <tr key={org.id} className="border-b border-zinc-100 align-top">
                <td className="py-3 pr-4">
                  <p className="font-medium text-zinc-900">{org.name}</p>
                  <p className="text-xs text-zinc-500">{org.slug}</p>
                  {org.status === "PENDING" && (
                    <p className="mt-1 max-w-xs text-xs text-zinc-500 line-clamp-2">
                      {org.presentation}
                    </p>
                  )}
                  {org.status === "REJECTED" && org.rejectReason && (
                    <p className="mt-1 max-w-xs text-xs text-red-600">{org.rejectReason}</p>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <OrgStatusBadge status={org.status} label={labels.statusLabel(org.status)} />
                </td>
                <td className="py-3 pr-4 text-zinc-700">{org.adminEmail ?? "—"}</td>
                <td className="py-3 pr-4 text-zinc-700">{formatDate(org.createdAt)}</td>
                <td className="py-3 pr-4 text-zinc-700">{org.mailboxCount}</td>
                <td className="py-3 pr-4 text-zinc-700">{org.domainCount}</td>
                <td className="py-3 pr-4 font-medium text-zinc-900">
                  {formatBytes(org.storageBytes)}
                </td>
                <td className="py-3 pr-4 text-zinc-700">
                  {org.monthlyCostEur != null ? formatEur(org.monthlyCostEur) : "—"}
                </td>
                <td className="py-3 pr-4 font-medium text-zinc-900">
                  {org.status === "APPROVED"
                    ? formatEur(org.walletBalanceCents / 100)
                    : "—"}
                </td>
                <td className="py-3">
                  {org.status === "PENDING" ? (
                    <OrgPendingActions orgId={org.id} labels={labels} />
                  ) : (
                    <span className="text-xs text-zinc-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
