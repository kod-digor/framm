"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  createMailboxFilterAction,
  deleteMailboxFilterAction,
  toggleMailboxFilterAction,
} from "@/app/actions/mailbox-filters";
import { CrudListCard } from "@/components/layout/crud-list-card";
import { CrudPageHeader } from "@/components/layout/crud-page-header";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { CrudAddButton } from "@/components/ui/crud-add-button";
import { DataTable } from "@/components/ui/data-table";
import { FormDrawer } from "@/components/ui/form-drawer";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INITIAL_ACTION_RESULT, type ActionResult } from "@/lib/action-result";
import type { MailboxFilterAction } from "@prisma/client";

export type MailboxFilterRow = {
  id: string;
  name: string;
  fromAddress: string | null;
  subjectContains: string | null;
  action: MailboxFilterAction;
  targetFolder: string | null;
  isEnabled: boolean;
};

export function MailboxFiltersCrud({
  mailboxId,
  mailboxAddress,
  filters,
}: {
  mailboxId: string;
  mailboxAddress: string;
  filters: MailboxFilterRow[];
}) {
  const t = useTranslations("mailFilters");
  const [createOpen, setCreateOpen] = useState(false);
  const [state, formAction] = useActionState(async (prev: ActionResult, formData: FormData) => {
    const result = await createMailboxFilterAction(prev, formData);
    if (result?.ok) setCreateOpen(false);
    return result;
  }, INITIAL_ACTION_RESULT);

  const columns = [
    {
      key: "name",
      header: t("colName"),
      cell: (row: MailboxFilterRow) => (
        <div>
          <p className="font-medium text-encre">{row.name}</p>
          <p className="text-xs text-ardoise/60">
            {row.fromAddress ? t("condFrom", { value: row.fromAddress }) : null}
            {row.fromAddress && row.subjectContains ? " · " : null}
            {row.subjectContains ? t("condSubject", { value: row.subjectContains }) : null}
          </p>
        </div>
      ),
    },
    {
      key: "action",
      header: t("colAction"),
      cell: (row: MailboxFilterRow) => {
        const actionLabel =
          row.action === "MOVE_TO"
            ? t("actionMoveTo")
            : row.action === "MARK_READ"
              ? t("actionMarkRead")
              : row.action === "MARK_FLAGGED"
                ? t("actionMarkFlagged")
                : row.action === "DELETE"
                  ? t("actionDelete")
                  : t("actionStop");
        return (
          <span className="text-sm text-ardoise/80">
            {actionLabel}
            {row.action === "MOVE_TO" && row.targetFolder ? ` → ${row.targetFolder}` : null}
          </span>
        );
      },
    },
    {
      key: "enabled",
      header: t("colEnabled"),
      cell: (row: MailboxFilterRow) => (
        <form action={toggleMailboxFilterAction} className="inline-flex">
          <input type="hidden" name="filterId" value={row.id} />
          <Button type="submit" variant="ghost" size="sm" className="h-8 px-2">
            {row.isEnabled ? t("enabled") : t("disabled")}
          </Button>
        </form>
      ),
    },
    {
      key: "actions",
      header: t("colActions"),
      cell: (row: MailboxFilterRow) => (
        <form action={deleteMailboxFilterAction}>
          <input type="hidden" name="filterId" value={row.id} />
          <ConfirmSubmitButton namespace="mailFilters" messageKey="confirmDelete" className="text-red-600">
            {t("delete")}
          </ConfirmSubmitButton>
        </form>
      ),
    },
  ];

  return (
    <>
      <CrudPageHeader
        title={t("title")}
        description={t("subtitle", { address: mailboxAddress })}
        action={<CrudAddButton label={t("add")} onClick={() => setCreateOpen(true)} />}
      />

      <FormDrawer open={createOpen} onOpenChange={setCreateOpen} title={t("add")}>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="mailboxId" value={mailboxId} />
          <div className="space-y-1.5">
            <Label htmlFor="filter-name">{t("name")}</Label>
            <Input id="filter-name" name="name" required placeholder={t("namePlaceholder")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-from">{t("fromAddress")}</Label>
            <Input id="filter-from" name="fromAddress" type="email" placeholder={t("fromPlaceholder")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-subject">{t("subjectContains")}</Label>
            <Input id="filter-subject" name="subjectContains" placeholder={t("subjectPlaceholder")} />
          </div>
          <p className="text-xs text-ardoise/60">{t("conditionHint")}</p>
          <div className="space-y-1.5">
            <Label htmlFor="filter-action">{t("action")}</Label>
            <select
              id="filter-action"
              name="action"
              required
              className="h-9 w-full rounded-md border border-canal bg-white px-3 text-sm"
              defaultValue="MOVE_TO"
            >
              <option value="MOVE_TO">{t("actionMoveTo")}</option>
              <option value="MARK_READ">{t("actionMarkRead")}</option>
              <option value="MARK_FLAGGED">{t("actionMarkFlagged")}</option>
              <option value="DELETE">{t("actionDelete")}</option>
              <option value="STOP">{t("actionStop")}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-folder">{t("targetFolder")}</Label>
            <Input id="filter-folder" name="targetFolder" placeholder={t("folderPlaceholder")} />
          </div>
          <Button type="submit">{t("save")}</Button>
          <FormFeedback state={state} namespace="mailFilters" />
        </form>
      </FormDrawer>

      <CrudListCard>
        <DataTable
          columns={columns}
          rows={filters}
          rowKey={(row) => row.id}
          emptyMessage={t("empty")}
        />
      </CrudListCard>
    </>
  );
}
