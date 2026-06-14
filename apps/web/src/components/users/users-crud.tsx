"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { ArrowRightLeft, Pencil } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { removeWorkspaceUserAction } from "@/app/actions/workspace-users";
import {
  getDraftMigrationAction,
  getMigrationStatusAction,
  listActiveMigrationsAction,
  resolveMigrationWizardEntryAction,
} from "@/app/actions/mailbox-migration";
import { CrudListCard } from "@/components/layout/crud-list-card";
import { CrudPageHeader } from "@/components/layout/crud-page-header";
import { CreateWorkspaceUserForm } from "@/components/users/create-workspace-user-form";
import { DeleteWorkspaceUserForm } from "@/components/users/delete-workspace-user-form";
import { EditUserDrawer } from "@/components/users/edit-workspace-user-form";
import { MigrationActiveBanner } from "@/components/users/migration-active-banner";
import { MigrationStatusChip } from "@/components/users/migration-status-chip";
import { MigrationStatusPanel } from "@/components/users/migration-status-panel";
import { MigrationWizard } from "@/components/users/migration-wizard";
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
import type { MigrationStatusPayload } from "@/lib/migration/types";
import {
  isLaunchedMigrationStatus,
  resolveDraftWizardStep,
} from "@/lib/migration/types";
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

function draftStorageKey(mailboxId: string) {
  return `framm:migration-draft:${mailboxId}`;
}

export function UsersCrud({
  users,
  domains,
  domainOptions,
  orgMembers,
  initialActiveMigrations = {},
}: {
  users: UserRow[];
  domains: DomainSimple[];
  domainOptions: DomainOption[];
  orgMembers: OrgMemberOption[];
  initialActiveMigrations?: Record<string, MigrationStatusPayload>;
}) {
  const t = useTranslations("users");
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthMailboxId = searchParams.get("migrationMailboxId");
  const oauthMigrationId = searchParams.get("migrationId");
  const oauthStep = searchParams.get("migrationStep");
  const oauthError = searchParams.get("migrationError");
  const migrationStatusMailbox = searchParams.get("migrationStatusMailbox");

  const [createOpen, setCreateOpen] = useState(false);
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const [migrationMailboxId, setMigrationMailboxId] = useState<string | null>(
    oauthMailboxId
  );
  const [migrationInitialId, setMigrationInitialId] = useState<string | null>(
    oauthMigrationId
  );
  const [migrationInitialStep, setMigrationInitialStep] = useState<
    "provider" | "credentials" | "auth" | "scope" | "confirm" | "status" | null
  >(
    oauthStep === "scope"
      ? "scope"
      : oauthStep === "credentials"
        ? "credentials"
        : oauthStep === "auth"
          ? "auth"
          : oauthStep === "confirm"
            ? "confirm"
            : null
  );
  const [migrationExistingAuth, setMigrationExistingAuth] = useState(false);
  const [migrationAuthExpired, setMigrationAuthExpired] = useState(false);
  const [activeMigrations, setActiveMigrations] = useState<
    Record<string, MigrationStatusPayload>
  >(initialActiveMigrations);
  const [draftMigration, setDraftMigration] = useState<MigrationStatusPayload | null>(null);
  const [statusDrawerMailboxId, setStatusDrawerMailboxId] = useState<string | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatusPayload | null>(null);
  const [deleteState, deleteAction] = useActionState(
    removeWorkspaceUserAction,
    INITIAL_ACTION_RESULT
  );

  const refreshMigrationStatus = useCallback(async (mailboxId: string) => {
    const status = await getMigrationStatusAction(mailboxId);
    setMigrationStatus(status);
    setActiveMigrations((prev) => {
      const next = { ...prev };
      if (status) {
        next[mailboxId] = status;
      } else {
        delete next[mailboxId];
      }
      return next;
    });
    return status;
  }, []);

  const refreshAllActiveMigrations = useCallback(async () => {
    const next = await listActiveMigrationsAction();
    setActiveMigrations(next);
    if (statusDrawerMailboxId && next[statusDrawerMailboxId]) {
      setMigrationStatus(next[statusDrawerMailboxId]);
    }
    if (migrationMailboxId && next[migrationMailboxId]) {
      setMigrationStatus(next[migrationMailboxId]);
    }
  }, [migrationMailboxId, statusDrawerMailboxId]);

  if (oauthError) {
    console.warn("[migration] OAuth error:", oauthError);
  }

  const oauthHandled = useRef(false);
  const statusMailboxHandled = useRef<string | null>(null);

  useEffect(() => {
    if (!migrationStatusMailbox || statusMailboxHandled.current === migrationStatusMailbox) {
      return;
    }
    statusMailboxHandled.current = migrationStatusMailbox;

    const user = users.find((u) => u.mailboxId === migrationStatusMailbox);
    if (!user?.mailboxId) return;

    void (async () => {
      const liveStatus = await getMigrationStatusAction(migrationStatusMailbox);
      if (liveStatus && isLaunchedMigrationStatus(liveStatus.status)) {
        setActiveMigrations((prev) => ({
          ...prev,
          [migrationStatusMailbox]: liveStatus,
        }));
        setStatusDrawerMailboxId(migrationStatusMailbox);
        setMigrationStatus(liveStatus);
      }
    })();

    const params = new URLSearchParams(searchParams.toString());
    params.delete("migrationStatusMailbox");
    const next = params.toString();
    router.replace(next ? `/dashboard/users?${next}` : "/dashboard/users", {
      scroll: false,
    });
  }, [migrationStatusMailbox, users, router, searchParams]);

  useEffect(() => {
    if (!oauthMailboxId || oauthHandled.current) return;
    oauthHandled.current = true;

    let cancelled = false;
    const loadDraft = oauthMigrationId
      ? getDraftMigrationAction(oauthMigrationId)
      : getDraftMigrationAction(oauthMailboxId, true);

    void loadDraft.then((draft) => {
      if (!cancelled && draft) {
        setDraftMigration(draft);
        setMigrationInitialId(draft.id);
        setMigrationInitialStep(oauthStep === "scope" ? "scope" : resolveDraftWizardStep(draft));
        setMigrationExistingAuth(true);
        setMigrationAuthExpired(false);
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(draftStorageKey(oauthMailboxId), draft.id);
        }
      }
    });

    const params = new URLSearchParams(searchParams.toString());
    params.delete("migrationId");
    params.delete("migrationMailboxId");
    params.delete("migrationStep");
    params.delete("migrationError");
    const next = params.toString();
    router.replace(next ? `/dashboard/users?${next}` : "/dashboard/users", {
      scroll: false,
    });

    return () => {
      cancelled = true;
    };
  }, [oauthMailboxId, oauthMigrationId, oauthStep, router, searchParams]);

  const hasRunningMigrations = Object.values(activeMigrations).some(
    (migration) => migration.status === "QUEUED" || migration.status === "RUNNING"
  );

  useEffect(() => {
    if (!hasRunningMigrations) return;

    const timer = setInterval(() => {
      void refreshAllActiveMigrations();
    }, 5000);

    return () => clearInterval(timer);
  }, [hasRunningMigrations, refreshAllActiveMigrations]);

  const selectedUser = users.find((user) => user.memberId === openUserId) ?? null;
  const migrationUser = users.find((u) => u.mailboxId === migrationMailboxId) ?? null;
  const statusDrawerUser = users.find((u) => u.mailboxId === statusDrawerMailboxId) ?? null;
  const statusDrawerMigration = statusDrawerMailboxId
    ? activeMigrations[statusDrawerMailboxId] ?? null
    : null;

  const runningMigrationCount = Object.values(activeMigrations).filter(
    (migration) => migration.status === "QUEUED" || migration.status === "RUNNING"
  ).length;

  const openMigration = (mailboxId: string) => {
    void (async () => {
      const cached = activeMigrations[mailboxId];
      if (cached && isLaunchedMigrationStatus(cached.status)) {
        openStatusDrawer(mailboxId);
        return;
      }

      const entry = await resolveMigrationWizardEntryAction(mailboxId);

      if (entry?.step === "status") {
        setActiveMigrations((prev) => ({ ...prev, [mailboxId]: entry.migration }));
        openStatusDrawer(mailboxId);
        return;
      }

      if (entry) {
        setStatusDrawerMailboxId(null);
        setMigrationInitialId(entry.migration.id);
        setMigrationInitialStep(entry.step);
        setMigrationExistingAuth(entry.existingAuth);
        setMigrationAuthExpired(entry.authExpired);
        setMigrationStatus(entry.migration);
        setDraftMigration(entry.migration);
        setMigrationMailboxId(mailboxId);

        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(draftStorageKey(mailboxId), entry.migration.id);
        }
        return;
      }

      let draft = await getDraftMigrationAction(mailboxId, true);
      if (!draft && typeof sessionStorage !== "undefined") {
        const cachedId = sessionStorage.getItem(draftStorageKey(mailboxId));
        if (cachedId) {
          draft = await getDraftMigrationAction(cachedId);
        }
      }

      setStatusDrawerMailboxId(null);
      setMigrationInitialId(draft?.id ?? null);
      setMigrationInitialStep(draft ? resolveDraftWizardStep(draft) : null);
      setMigrationExistingAuth(false);
      setMigrationAuthExpired(false);
      setMigrationStatus(draft);
      setDraftMigration(draft);
      setMigrationMailboxId(mailboxId);

      if (draft?.id && typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(draftStorageKey(mailboxId), draft.id);
      }
    })();
  };

  const openStatusDrawer = (mailboxId: string) => {
    setStatusDrawerMailboxId(mailboxId);
    void refreshMigrationStatus(mailboxId);
  };

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
      cell: (row: UserRow) => {
        const migration = row.mailboxId ? activeMigrations[row.mailboxId] : null;

        return (
          <div className="space-y-1.5">
            {row.primaryAddress ? (
              <span className="font-mono-data text-encre">{row.primaryAddress}</span>
            ) : (
              <span className="text-ardoise/50">{t("noMailbox")}</span>
            )}
            {migration && isLaunchedMigrationStatus(migration.status) ? (
              <MigrationStatusChip
                status={migration}
                onClick={() => openStatusDrawer(row.mailboxId!)}
              />
            ) : null}
          </div>
        );
      },
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
          {row.mailboxId ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={crudIconButtonClass}
              aria-label={t("migration.migrateAria", { email: row.userEmail })}
              onClick={() => openMigration(row.mailboxId!)}
            >
              <ArrowRightLeft className="size-4" aria-hidden />
            </Button>
          ) : null}
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

      <MigrationActiveBanner count={runningMigrationCount} />

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

      {migrationUser?.mailboxId && migrationUser.primaryAddress ? (
        <MigrationWizard
          key={`${migrationUser.mailboxId}:${migrationInitialId ?? "new"}:${migrationInitialStep ?? "provider"}`}
          open={migrationMailboxId !== null}
          onOpenChange={(open) => {
            if (!open) {
              setMigrationMailboxId(null);
              setMigrationInitialId(null);
              setMigrationInitialStep(null);
              setMigrationExistingAuth(false);
              setMigrationAuthExpired(false);
              setDraftMigration(null);
              setMigrationStatus(null);
              void refreshAllActiveMigrations();
            }
          }}
          mailboxId={migrationUser.mailboxId}
          targetAddress={migrationUser.primaryAddress}
          userEmail={migrationUser.userEmail}
          initialMigrationId={migrationInitialId}
          initialStep={migrationInitialStep}
          initialExistingAuth={migrationExistingAuth}
          initialAuthExpired={migrationAuthExpired}
          activeStatus={
            migrationStatus ??
            (draftMigration?.mailboxId === migrationUser.mailboxId ? draftMigration : null)
          }
          onStatusChange={() => refreshMigrationStatus(migrationUser.mailboxId!)}
        />
      ) : null}

      {statusDrawerUser?.mailboxId && statusDrawerMigration ? (
        <FormDrawer
          open={statusDrawerMailboxId !== null}
          onOpenChange={(open) => {
            if (!open) {
              setStatusDrawerMailboxId(null);
              void refreshAllActiveMigrations();
            }
          }}
          title={t("migration.statusTitle")}
          description={t("migration.wizardHint", { email: statusDrawerUser.userEmail })}
        >
          <MigrationStatusPanel
            mailboxId={statusDrawerUser.mailboxId}
            migrationId={statusDrawerMigration.id}
            initialStatus={statusDrawerMigration}
            onCancelled={() => {
              void refreshAllActiveMigrations();
            }}
          />
        </FormDrawer>
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
