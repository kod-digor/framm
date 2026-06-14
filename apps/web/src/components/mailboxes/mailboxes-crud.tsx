"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Mailbox } from "lucide-react";
import { CrudListCard } from "@/components/layout/crud-list-card";
import { CrudPageHeader } from "@/components/layout/crud-page-header";
import { CreateMailboxForm } from "@/components/mailboxes/create-mailbox-form";
import { MailboxList, type MailboxListLabels, type MailboxRow } from "@/components/mailboxes/mailbox-list";
import { CrudAddButton } from "@/components/ui/crud-add-button";
import { FormDrawer } from "@/components/ui/form-drawer";

type DomainOption = { id: string; fqdn: string; isDnsVerified: boolean };

export function MailboxesCrud({
  mailboxes,
  domains,
  listLabels,
}: {
  mailboxes: MailboxRow[];
  domains: DomainOption[];
  listLabels: MailboxListLabels;
}) {
  const t = useTranslations("mailboxes");
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <CrudPageHeader
        title={t("title")}
        action={
          domains.length > 0 ? (
            <CrudAddButton label={t("add")} onClick={() => setCreateOpen(true)} />
          ) : null
        }
      />

      {domains.length === 0 ? (
        <p className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("noDomain")}
        </p>
      ) : null}

      <FormDrawer open={createOpen} onOpenChange={setCreateOpen} title={t("add")}>
        <CreateMailboxForm domains={domains} onSuccess={() => setCreateOpen(false)} />
      </FormDrawer>

      <CrudListCard>
        {mailboxes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-canal bg-zinc-50 px-6 py-10 text-center">
            <Mailbox className="mx-auto size-8 text-zinc-300" aria-hidden />
            <p className="mt-3 text-sm font-medium text-zinc-700">{t("emptyTitle")}</p>
            <p className="mt-1 text-sm text-zinc-500">{t("emptyHint")}</p>
          </div>
        ) : (
          <MailboxList mailboxes={mailboxes} labels={listLabels} />
        )}
      </CrudListCard>
    </>
  );
}
