"use client";

import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Calendar,
  CheckCircle2,
  Loader2,
  Mail,
  Plug,
  Search,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  cancelMigrationAction,
  getMigrationStatusAction,
} from "@/app/actions/mailbox-migration";
import { Button } from "@/components/ui/button";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";
import {
  estimateMigrationEtaMs,
  filterMigrationEvents,
  formatDurationMs,
  formatMigrationEventMessage,
  formatMigrationFolderName,
  formatRelativeTimeFr,
  getMigrationProgressSummary,
} from "@/lib/migration/display";
import {
  isMigrationErrorCode,
  MIGRATION_ERROR_I18N_KEYS,
  type MigrationStatusPayload,
} from "@/lib/migration/types";
import type { MigrationPhase } from "@prisma/client";
import { cn } from "@/lib/utils";

const PHASE_ICONS: Record<MigrationPhase, LucideIcon> = {
  CONNECTING: Plug,
  SCANNING: Search,
  SYNCING_MAIL: Mail,
  SYNCING_CONTACTS: Users,
  SYNCING_CALENDAR: Calendar,
  FINALIZING: CheckCircle2,
};

function CancelButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("users");

  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending} aria-busy={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-1 size-4 animate-spin" aria-hidden />
          {t("migration.cancelling")}
        </>
      ) : (
        <>
          <XCircle className="mr-1 size-4" aria-hidden />
          {t("migration.cancelMigration")}
        </>
      )}
    </Button>
  );
}

function PhaseBadge({ phase }: { phase: MigrationPhase }) {
  const t = useTranslations("users");
  const Icon = PHASE_ICONS[phase];

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-canal/60 px-2.5 py-1 text-xs font-medium text-ardoise">
      <Icon className="size-3.5 shrink-0 text-encre/70" aria-hidden />
      {t(`migration.phase_${phase}`)}
    </span>
  );
}

export function MigrationStatusPanel({
  mailboxId,
  migrationId,
  initialStatus,
  onCancelled,
}: {
  mailboxId: string;
  migrationId: string;
  initialStatus?: MigrationStatusPayload | null;
  onCancelled?: () => void;
}) {
  const t = useTranslations("users");
  const [polledStatus, setPolledStatus] = useState<MigrationStatusPayload | null>(null);
  const [, setTick] = useState(0);

  const refresh = useCallback(async () => {
    const next = await getMigrationStatusAction(mailboxId, migrationId);
    setPolledStatus(next);
    return next;
  }, [mailboxId, migrationId]);

  const [, cancelAction] = useActionState(
    async (_prev: ActionResult, formData: FormData) => {
      const result = await cancelMigrationAction(_prev, formData);
      if (result?.ok) {
        await refresh();
        onCancelled?.();
      }
      return result;
    },
    INITIAL_ACTION_RESULT
  );

  useEffect(() => {
    let cancelled = false;
    void getMigrationStatusAction(mailboxId, migrationId).then((next) => {
      if (!cancelled) setPolledStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, [mailboxId, migrationId]);

  useEffect(() => {
    const status = polledStatus ?? initialStatus;
    if (!status) return;
    if (status.status !== "QUEUED" && status.status !== "RUNNING") {
      return;
    }

    const timer = setInterval(() => {
      void refresh();
    }, 5000);

    return () => clearInterval(timer);
  }, [polledStatus, initialStatus, refresh, migrationId]);

  useEffect(() => {
    const status = polledStatus ?? initialStatus;
    if (!status || (status.status !== "QUEUED" && status.status !== "RUNNING")) {
      return;
    }
    const timer = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, [polledStatus, initialStatus]);

  const status = polledStatus ?? initialStatus;

  const filteredEvents = useMemo(
    () => (status ? filterMigrationEvents(status.events) : []),
    [status]
  );

  if (!status) {
    return <p className="text-sm text-ardoise/60">{t("migration.noActiveMigration")}</p>;
  }

  const percent = status.progress?.percent ?? 0;
  const isActive = status.status === "QUEUED" || status.status === "RUNNING";
  const showProgress = isActive;
  const isSuccess = status.status === "COMPLETED";
  const isFailed = status.status === "FAILED";
  const isCancelled = status.status === "CANCELLED";
  const progressSummary = getMigrationProgressSummary(status);

  const etaMs =
    progressSummary.kind === "messages"
      ? estimateMigrationEtaMs(
          status.startedAt,
          progressSummary.synced,
          progressSummary.total
        )
      : null;

  const statusLabel = t(`migration.status_${status.status}`);
  const formattedFolder = status.progress?.currentFolder
    ? formatMigrationFolderName(status.progress.currentFolder)
    : null;

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-lg border border-canal bg-neutral-50/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-encre">{statusLabel}</span>
          {status.phase ? <PhaseBadge phase={status.phase} /> : null}
        </div>

        {showProgress ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ardoise/70">{t("migration.progressAria")}</span>
              <span className="font-medium tabular-nums text-encre">{percent}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-canal">
              <div
                className={cn(
                  "h-full transition-all duration-500",
                  isSuccess ? "bg-green-600" : isFailed ? "bg-red-600" : "bg-encre"
                )}
                style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t("migration.progressAria")}
              />
            </div>
            {etaMs ? (
              <p className="text-xs text-ardoise/60">
                {t("migration.etaRemaining", { duration: formatDurationMs(etaMs) })}
              </p>
            ) : null}
          </div>
        ) : null}

        <dl className="grid gap-2 text-sm">
          {progressSummary.kind === "messages" ? (
            <div className="flex justify-between gap-4">
              <dt className="text-ardoise/60">{t("migration.scopeMail")}</dt>
              <dd className="font-medium tabular-nums text-encre">
                {t("migration.progressMessages", {
                  synced: progressSummary.synced,
                  total: progressSummary.total,
                })}
              </dd>
            </div>
          ) : null}
          {progressSummary.kind === "contacts" ? (
            <div className="flex justify-between gap-4">
              <dt className="text-ardoise/60">{t("migration.scopeContacts")}</dt>
              <dd className="font-medium tabular-nums text-encre">
                {t("migration.progressContacts", {
                  synced: progressSummary.synced,
                  total: progressSummary.total,
                })}
              </dd>
            </div>
          ) : null}
          {progressSummary.kind === "calendar" ? (
            <div className="flex justify-between gap-4">
              <dt className="text-ardoise/60">{t("migration.scopeCalendar")}</dt>
              <dd className="font-medium tabular-nums text-encre">
                {t("migration.progressCalendar", {
                  synced: progressSummary.synced,
                  total: progressSummary.total,
                })}
              </dd>
            </div>
          ) : null}
          {formattedFolder ? (
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-ardoise/60">{t("migration.folderLabelShort")}</dt>
              <dd className="truncate text-right font-medium text-encre" title={formattedFolder}>
                {formattedFolder}
              </dd>
            </div>
          ) : null}
        </dl>

        {status.errorMessage ? (
          <p className="text-sm text-red-700">
            {isMigrationErrorCode(status.errorMessage)
              ? t(MIGRATION_ERROR_I18N_KEYS[status.errorMessage])
              : status.errorMessage}
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-canal bg-white">
        <h4 className="border-b border-canal px-4 py-3 text-sm font-semibold text-encre">
          {t("migration.eventsTitle")}
        </h4>
        <ul className="max-h-52 divide-y divide-canal overflow-y-auto">
          {filteredEvents.length === 0 ? (
            <li className="px-4 py-3 text-sm text-ardoise/50">{t("migration.eventsEmpty")}</li>
          ) : (
            [...filteredEvents].reverse().map((event) => {
              const displayMessage = formatMigrationEventMessage(event.message, (key) =>
                t(key)
              );

              return (
                <li key={event.id} className="flex gap-3 px-4 py-2.5 text-xs">
                  <time
                    className="shrink-0 tabular-nums text-ardoise/45"
                    dateTime={event.createdAt}
                    title={new Date(event.createdAt).toLocaleString()}
                  >
                    {formatRelativeTimeFr(event.createdAt)}
                  </time>
                  <span className="min-w-0 text-ardoise/80">{displayMessage}</span>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {isActive ? (
        <form action={cancelAction}>
          <input type="hidden" name="migrationId" value={migrationId} />
          <CancelButton />
        </form>
      ) : null}

      {isSuccess ? (
        <p className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {t("migration.completedMessage", { address: status.targetAddress })}
        </p>
      ) : null}

      {isCancelled ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("migration.cancelledMessage")}
        </p>
      ) : null}
    </div>
  );
}
