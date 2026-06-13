import { ArrowRight } from "lucide-react";
import { deleteAliasAction, updateAliasAction } from "@/app/actions/aliases";
import { AliasEmailBadge } from "@/components/aliases/alias-email-badge";
import { AliasStatusBadge } from "@/components/aliases/alias-status-badge";
import { DeleteAliasForm } from "@/components/aliases/delete-alias-form";
import { EditAliasDestination, EditAliasForm } from "@/components/aliases/edit-alias-form";

export type AliasRow = {
  id: string;
  source: string;
  destination: string;
  domain: string;
};

export type AliasListLabels = {
  colSource: string;
  colDestination: string;
  colDomain: string;
  colStatus: string;
  colActions: string;
  statusActive: string;
};

function AliasMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

function AliasMobileCard({
  alias,
  labels,
}: {
  alias: AliasRow;
  labels: AliasListLabels;
}) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {labels.colSource}
          </p>
          <AliasEmailBadge email={alias.source} />
        </div>
        <AliasStatusBadge label={labels.statusActive} />
      </div>

      <div className="mt-4 flex items-center gap-2 text-zinc-400">
        <ArrowRight className="size-4 shrink-0" aria-hidden />
        <span className="sr-only">{labels.colDestination}</span>
      </div>

      <dl className="mt-3 grid gap-3">
        <AliasMetric
          label={labels.colDestination}
          value={<AliasEmailBadge email={alias.destination} />}
        />
        <AliasMetric
          label={labels.colDomain}
          value={<span className="font-mono text-sm text-zinc-700">{alias.domain}</span>}
        />
      </dl>

      <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {labels.colActions}
        </p>
        <div className="flex items-center gap-1">
          <EditAliasForm
            action={updateAliasAction}
            aliasId={alias.id}
            source={alias.source}
            destination={alias.destination}
          />
          <DeleteAliasForm
            action={deleteAliasAction}
            aliasId={alias.id}
            source={alias.source}
          />
        </div>
      </div>
    </article>
  );
}

export function AliasList({
  aliases,
  labels,
}: {
  aliases: AliasRow[];
  labels: AliasListLabels;
}) {
  return (
    <>
      <div className="space-y-4 lg:hidden">
        {aliases.map((alias) => (
          <AliasMobileCard key={alias.id} alias={alias} labels={labels} />
        ))}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b text-zinc-500">
              <th className="pb-2 pr-4 font-medium">{labels.colSource}</th>
              <th className="pb-2 pr-4 font-medium">{labels.colDestination}</th>
              <th className="pb-2 pr-4 font-medium">{labels.colDomain}</th>
              <th className="pb-2 pr-4 font-medium">{labels.colStatus}</th>
              <th className="pb-2 font-medium">{labels.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {aliases.map((alias) => (
              <tr key={alias.id} className="border-b border-zinc-100 align-middle">
                <td className="max-w-xs py-3 pr-4">
                  <AliasEmailBadge email={alias.source} />
                </td>
                <td className="max-w-sm py-3 pr-4">
                  <EditAliasDestination
                    action={updateAliasAction}
                    aliasId={alias.id}
                    source={alias.source}
                    destination={alias.destination}
                  />
                </td>
                <td className="py-3 pr-4 font-mono text-zinc-700">{alias.domain}</td>
                <td className="py-3 pr-4">
                  <AliasStatusBadge label={labels.statusActive} />
                </td>
                <td className="py-3">
                  <DeleteAliasForm
                    action={deleteAliasAction}
                    aliasId={alias.id}
                    source={alias.source}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
