"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { removeWorkspaceUserAction } from "@/app/actions/workspace-users";
import { CrudListCard } from "@/components/layout/crud-list-card";
import { CrudPageHeader } from "@/components/layout/crud-page-header";
import { CreateWorkspaceUserForm } from "@/components/users/create-workspace-user-form";
import { DeleteWorkspaceUserForm } from "@/components/users/delete-workspace-user-form";
import { EditUserDrawer } from "@/components/users/edit-workspace-user-form";
import { CrudAddButton } from "@/components/ui/crud-add-button";
import {
  CrudRowActions,
  CRUD_ACTIONS_CELL_CLASS,
  CRUD_ACTIONS_HEADER_CLASS,
  crudIconButtonClass,
} from "@/components/ui/crud-row-actions";
import { DataTable } from "@/components/ui/data-table";
import { FormDrawer } from "@/components/ui/form-drawer";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Button } from "@/components/ui/button";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";
import type { DelegationRow } from "@/components/mail/mailbox-delegations-section";
import type { OrgMemberOption } from "@/components/shared-mailboxes/org-members-picker";
import type { MailboxAddressPatternType } from "@prisma/client";

export type UserRow = {
  memberId: string;
  userId: string;
  userEmail: string;
  displayName: string | null;
  primaryAddress: string | null;
  mailboxId: string | null;
  mustChangePassword: boolean;
  alternateAddresses: {
    id: string;
    address: string;
    patternType: MailboxAddressPatternType;
  }[];
  delegationsGranted: DelegationRow[];
};

type DomainOption = { id: string; fqdn: string; isDnsVerified: boolean };
type DomainSimple = { id: string; fqdn: string };

export function UsersCrud({
  users,
  domains,
  domainOptions,
  orgMembers,
}: {
  users: UserRow[];
  domains: DomainSimple[];
  domainOptions: DomainOption[];
  orgMembers: OrgMemberOption[];
}) {
  const t = useTranslations("users");
  const [createOpen, setCreateOpen] = useState(false);
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const [deleteState, deleteAction] = useActionState(
    removeWorkspaceUserAction,
    INITIAL_ACTION_RESULT
  );

  const selectedUser = users.find((user) => user.memberId === openUserId) ?? null;

  const columns = [
    {
      key: "loginEmail",
      header: t("colLoginEmail"),
      cell: (row: UserRow) => (
        <div>
          <p className="font-medium text-ardoise">{row.userEmail}</p>
          {row.displayName ? (
            <p className="text-xs text-ardoise/60">{row.displayName}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "primaryAddress",
      header: t("colPrimaryAddress"),
      cell: (row: UserRow) =>
        row.primaryAddress ? (
          <span className="font-mono-data text-encre">{row.primaryAddress}</span>
        ) : (
          <span className="text-ardoise/50">{t("noMailbox")}</span>
        ),
    },
    {
      key: "secondaryAddresses",
      header: t("colSecondaryAddresses"),
      cell: (row: UserRow) => {
        if (!row.mailboxId || row.alternateAddresses.length === 0) {
          return <span className="text-ardoise/40">—</span>;
        }

        return (
          <ul className="space-y-1">
            {row.alternateAddresses.map((alt) => (
              <li key={alt.id}>
                <span className="font-mono-data text-sm text-ardoise/80">{alt.address}</span>
              </li>
            ))}
          </ul>
        );
      },
    },
    {
      key: "actions",
      header: t("colActions"),
      headerClassName: CRUD_ACTIONS_HEADER_CLASS,
      cellClassName: CRUD_ACTIONS_CELL_CLASS,
      cell: (row: UserRow) => (
        <CrudRowActions>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={crudIconButtonClass}
            aria-label={t("editAria", { email: row.userEmail })}
            onClick={() => setOpenUserId(row.memberId)}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
          <DeleteWorkspaceUserForm
            action={deleteAction}
            memberId={row.memberId}
            email={row.userEmail}
          />
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
          domainOptions.length > 0 ? (
            <CrudAddButton label={t("add")} onClick={() => setCreateOpen(true)} />
          ) : null
        }
      />

      {domainOptions.length === 0 ? (
        <p className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("noDomain")}
        </p>
      ) : null}

      <FormFeedback state={deleteState} namespace="users" paramKey="detail" />

      <FormDrawer open={createOpen} onOpenChange={setCreateOpen} title={t("add")}>
        <CreateWorkspaceUserForm
          domains={domainOptions}
          onSuccess={() => setCreateOpen(false)}
        />
      </FormDrawer>

      {selectedUser ? (
        <EditUserDrawer
          open={openUserId !== null}
          onOpenChange={(open) => {
            if (!open) setOpenUserId(null);
          }}
          memberId={selectedUser.memberId}
          userId={selectedUser.userId}
          userEmail={selectedUser.userEmail}
          displayName={selectedUser.displayName}
          primaryAddress={selectedUser.primaryAddress}
          mailboxId={selectedUser.mailboxId}
          alternateAddresses={selectedUser.alternateAddresses}
          mustChangePassword={selectedUser.mustChangePassword}
          domains={domains}
          delegationsGranted={selectedUser.delegationsGranted}
          orgMembers={orgMembers}
        />
      ) : null}

      <CrudListCard>
        <DataTable
          columns={columns}
          rows={users}
          rowKey={(row) => row.memberId}
          emptyMessage={t("empty")}
        />
      </CrudListCard>
    </>
  );
}
