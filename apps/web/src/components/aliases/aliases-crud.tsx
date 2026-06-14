"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { deleteAliasAction } from "@/app/actions/aliases";
import { CrudListCard } from "@/components/layout/crud-list-card";
import { CrudPageHeader } from "@/components/layout/crud-page-header";
import { CreateAliasForm } from "@/components/aliases/create-alias-form";
import { DeleteAliasForm } from "@/components/aliases/delete-alias-form";
import { EditAliasForm } from "@/components/aliases/edit-alias-form";
import { CrudAddButton } from "@/components/ui/crud-add-button";
import {
  CrudRowActions,
  CRUD_ACTIONS_CELL_CLASS,
  CRUD_ACTIONS_HEADER_CLASS,
} from "@/components/ui/crud-row-actions";
import { DataTable } from "@/components/ui/data-table";
import { FormDrawer } from "@/components/ui/form-drawer";
import { FormFeedback } from "@/components/ui/form-feedback";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";

export type AliasRow = {
  id: string;
  source: string;
  destination: string;
  domain: string;
};

type DomainOption = { id: string; fqdn: string; isDnsVerified: boolean };

export function AliasesCrud({
  aliases,
  domains,
}: {
  aliases: AliasRow[];
  domains: DomainOption[];
}) {
  const t = useTranslations("aliases");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteState, deleteAction] = useActionState(deleteAliasAction, INITIAL_ACTION_RESULT);

  const columns = [
    {
      key: "source",
      header: t("colSource"),
      cell: (row: AliasRow) => (
        <p className="font-mono-data text-sm font-medium text-encre">{row.source}</p>
      ),
    },
    {
      key: "destination",
      header: t("colDestination"),
      cell: (row: AliasRow) => (
        <p className="font-mono-data text-sm font-medium text-encre">{row.destination}</p>
      ),
    },
    {
      key: "domain",
      header: t("colDomain"),
      cell: (row: AliasRow) => (
        <span className="font-medium text-ardoise">{row.domain}</span>
      ),
    },
    {
      key: "status",
      header: t("colStatus"),
      cell: () => (
        <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
          {t("statusActive")}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("colActions"),
      headerClassName: CRUD_ACTIONS_HEADER_CLASS,
      cellClassName: CRUD_ACTIONS_CELL_CLASS,
      cell: (row: AliasRow) => (
        <CrudRowActions>
          <EditAliasForm
            aliasId={row.id}
            source={row.source}
            destination={row.destination}
          />
          <DeleteAliasForm action={deleteAction} aliasId={row.id} source={row.source} />
        </CrudRowActions>
      ),
    },
  ];

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
        <CreateAliasForm domains={domains} onSuccess={() => setCreateOpen(false)} />
      </FormDrawer>

      <FormFeedback state={deleteState} namespace="aliases" paramKey="source" />

      <CrudListCard>
        <DataTable
          columns={columns}
          rows={aliases}
          rowKey={(row) => row.id}
          emptyMessage={t("empty")}
        />
      </CrudListCard>
    </>
  );
}
