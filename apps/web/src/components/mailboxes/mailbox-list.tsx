"use client";

import Link from "next/link";
import { useActionState } from "react";
import { deleteMailboxAction } from "@/app/actions/mailboxes";
import { AliasEmailBadge } from "@/components/aliases/alias-email-badge";
import { DeleteMailboxForm } from "@/components/mailboxes/delete-mailbox-form";
import {
  EditMailboxDisplayName,
  EditMailboxForm,
} from "@/components/mailboxes/edit-mailbox-form";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Button } from "@/components/ui/button";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";
import { formatBytes } from "@/lib/utils";

export type MailboxRow = {
  id: string;
  address: string;
  displayName: string | null;
  domain: string;
  usedBytes: number;
  quotaBytes: number;
};

export type MailboxListLabels = {
  colAddress: string;
  colDisplayName: string;
  colDomain: string;
  colQuota: string;
  colActions: string;
  config: string;
};

function MailboxMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

function QuotaBar({ used, quota, label }: { used: number; quota: number; label: string }) {
  const percent = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-zinc-500">
        <span>{label}</span>
        <span>
          {formatBytes(used)} / {formatBytes(quota)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-zinc-900 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function MailboxMobileCard({
  mailbox,
  labels,
  deleteAction,
}: {
  mailbox: MailboxRow;
  labels: MailboxListLabels;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {labels.colAddress}
          </p>
          <AliasEmailBadge email={mailbox.address} />
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href={`/dashboard/mailboxes/${mailbox.id}`}>{labels.config}</Link>
        </Button>
      </div>

      <dl className="mt-4 grid gap-3">
        <MailboxMetric
          label={labels.colDisplayName}
          value={
            <span className="text-sm text-zinc-700">{mailbox.displayName || "—"}</span>
          }
        />
        <MailboxMetric
          label={labels.colDomain}
          value={<span className="font-mono text-sm text-zinc-700">{mailbox.domain}</span>}
        />
        <MailboxMetric
          label={labels.colQuota}
          value={
            <QuotaBar used={mailbox.usedBytes} quota={mailbox.quotaBytes} label={labels.colQuota} />
          }
        />
      </dl>

      <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {labels.colActions}
        </p>
        <div className="flex items-center gap-1">
          <EditMailboxForm
            mailboxId={mailbox.id}
            address={mailbox.address}
            displayName={mailbox.displayName}
          />
          <DeleteMailboxForm
            action={deleteAction}
            mailboxId={mailbox.id}
            address={mailbox.address}
          />
        </div>
      </div>
    </article>
  );
}

export function MailboxList({
  mailboxes,
  labels,
}: {
  mailboxes: MailboxRow[];
  labels: MailboxListLabels;
}) {
  const [deleteState, deleteAction] = useActionState(deleteMailboxAction, INITIAL_ACTION_RESULT);

  return (
    <>
      <FormFeedback state={deleteState} namespace="mailboxes" paramKey="address" />

      <div className="space-y-4 lg:hidden">
        {mailboxes.map((mailbox) => (
          <MailboxMobileCard
            key={mailbox.id}
            mailbox={mailbox}
            labels={labels}
            deleteAction={deleteAction}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b text-zinc-500">
              <th className="pb-2 pr-4 font-medium">{labels.colAddress}</th>
              <th className="pb-2 pr-4 font-medium">{labels.colDisplayName}</th>
              <th className="pb-2 pr-4 font-medium">{labels.colDomain}</th>
              <th className="pb-2 pr-4 font-medium">{labels.colQuota}</th>
              <th className="pb-2 font-medium">{labels.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {mailboxes.map((mailbox) => (
              <tr key={mailbox.id} className="border-b border-zinc-100 align-middle">
                <td className="max-w-xs py-3 pr-4">
                  <AliasEmailBadge email={mailbox.address} />
                </td>
                <td className="max-w-sm py-3 pr-4">
                  <EditMailboxDisplayName
                    mailboxId={mailbox.id}
                    address={mailbox.address}
                    displayName={mailbox.displayName}
                  />
                </td>
                <td className="py-3 pr-4 font-mono text-zinc-700">{mailbox.domain}</td>
                <td className="min-w-[140px] py-3 pr-4">
                  <QuotaBar
                    used={mailbox.usedBytes}
                    quota={mailbox.quotaBytes}
                    label={labels.colQuota}
                  />
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-1">
                    <EditMailboxForm
                      mailboxId={mailbox.id}
                      address={mailbox.address}
                      displayName={mailbox.displayName}
                    />
                    <DeleteMailboxForm
                      action={deleteAction}
                      mailboxId={mailbox.id}
                      address={mailbox.address}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
