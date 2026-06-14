"use client";

import { useState } from "react";
import { Pencil, Mail } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { deleteSharedMailboxAction } from "@/app/actions/shared-mailboxes";
import { CrudListCard } from "@/components/layout/crud-list-card";
import { CrudPageHeader } from "@/components/layout/crud-page-header";
import { CreateSharedMailboxForm } from "@/components/shared-mailboxes/create-shared-mailbox-form";
import { EditSharedMailboxForm } from "@/components/shared-mailboxes/edit-shared-mailbox-form";
import type { OrgMemberOption } from "@/components/shared-mailboxes/org-members-picker";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { CrudAddButton } from "@/components/ui/crud-add-button";
import {
  CrudRowActions,
  CRUD_ACTIONS_CELL_CLASS,
  CRUD_ACTIONS_HEADER_CLASS,
  crudIconButtonClass,
} from "@/components/ui/crud-row-actions";
import { DataTable } from "@/components/ui/data-table";
import { FormDrawer } from "@/components/ui/form-drawer";
import { Button } from "@/components/ui/button";

export type SharedMailboxMemberRow = {
  id: string;
  userId: string;
  label: string;
  email: string;
};

export type SharedMailboxRow = {
  id: string;
  address: string;
  displayName: string | null;
  mailboxId: string;
  members: SharedMailboxMemberRow[];
};

type DomainOption = { id: string; fqdn: string; isDnsVerified: boolean };

export function SharedMailboxesCrud({
  sharedMailboxes,
  domainOptions,
  orgMembers,
}: {
  sharedMailboxes: SharedMailboxRow[];
  domainOptions: DomainOption[];
  orgMembers: OrgMemberOption[];
}) {
  const t = useTranslations("sharedMailboxes");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SharedMailboxRow | null>(null);

  const columns = [
    {
      key: "address",
      header: t("colAddress"),
      cell: (row: SharedMailboxRow) => (
        <div>
          <p className="font-mono-data text-sm font-medium text-encre">{row.address}</p>
          {row.displayName ? (
            <p className="text-xs text-ardoise/60">{row.displayName}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "members",
      header: t("colMembers"),
      cell: (row: SharedMailboxRow) =>
        row.members.length === 0 ? (
          <span className="text-ardoise/40">—</span>
        ) : (
          <ul className="space-y-1">
            {row.members.map((member) => (
              <li key={member.id} className="text-sm text-ardoise/80">
                <span className="font-medium text-encre">{member.label}</span>
                <span className="ml-1 font-mono-data text-xs text-ardoise/50">({member.email})</span>
              </li>
            ))}
          </ul>
        ),
    },
    {
      key: "actions",
      header: t("colActions"),
      headerClassName: CRUD_ACTIONS_HEADER_CLASS,
      cellClassName: CRUD_ACTIONS_CELL_CLASS,
      cell: (row: SharedMailboxRow) => (
        <CrudRowActions>
          <Button asChild variant="ghost" size="sm" className={crudIconButtonClass}>
            <Link
              href={`/dashboard/mail/${row.mailboxId}`}
              aria-label={t("openMailAria", { address: row.address })}
            >
              <Mail className="size-4" aria-hidden />
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={crudIconButtonClass}
            aria-label={t("editAria", { address: row.address })}
            onClick={() => setEditTarget(row)}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
          <form action={deleteSharedMailboxAction} className="inline-flex">
            <input type="hidden" name="sharedMailboxId" value={row.id} />
            <ConfirmSubmitButton
              namespace="sharedMailboxes"
              messageKey="confirmDelete"
              iconOnly
              ariaLabel={t("deleteAria", { address: row.address })}
            />
          </form>
        </CrudRowActions>
      ),
    },
  ];

  return (
    <>
      <CrudPageHeader
        title={t("title")}
        description={t("subtitle")}
        action={
          domainOptions.length > 0 && orgMembers.length > 0 ? (
            <CrudAddButton label={t("add")} onClick={() => setCreateOpen(true)} />
          ) : null
        }
      />

      {domainOptions.length === 0 ? (
        <p className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("noDomain")}
        </p>
      ) : null}

      {orgMembers.length === 0 ? (
        <p className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("noOrgMembers")}
        </p>
      ) : null}

      <FormDrawer open={createOpen} onOpenChange={setCreateOpen} title={t("add")}>
        <CreateSharedMailboxForm
          domains={domainOptions}
          orgMembers={orgMembers}
          onSuccess={() => setCreateOpen(false)}
        />
      </FormDrawer>

      <FormDrawer
        open={editTarget != null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        title={t("editTitle")}
        description={editTarget ? t("editHint", { address: editTarget.address }) : undefined}
      >
        {editTarget ? (
          <EditSharedMailboxForm
            key={editTarget.id}
            sharedMailboxId={editTarget.id}
            address={editTarget.address}
            displayName={editTarget.displayName}
            memberUserIds={editTarget.members.map((m) => m.userId)}
            orgMembers={orgMembers}
            onSuccess={() => setEditTarget(null)}
            onCancel={() => setEditTarget(null)}
          />
        ) : null}
      </FormDrawer>

      <CrudListCard>
        <DataTable
          columns={columns}
          rows={sharedMailboxes}
          rowKey={(row) => row.id}
          emptyMessage={t("empty")}
        />
      </CrudListCard>
    </>
  );
}
