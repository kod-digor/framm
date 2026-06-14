"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  cancelMigrationAction,
  getMigrationStatusAction,
} from "@/app/actions/mailbox-migration";
import { Button } from "@/components/ui/button";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";
import {
  isMigrationErrorCode,
  MIGRATION_ERROR_I18N_KEYS,
  type MigrationStatusPayload,
} from "@/lib/migration/types";
import { cn } from "@/lib/utils";

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

  const refresh = useCallback(async () => {
    const next = await getMigrationStatusAction(mailboxId);
    setPolledStatus(next);
    return next;
  }, [mailboxId]);

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
    void getMigrationStatusAction(mailboxId).then((next) => {
      if (!cancelled) setPolledStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, [mailboxId]);

  useEffect(() => {
    const status = polledStatus ?? initialStatus;
    if (!status) return;
    if (
      status.status === "COMPLETED" ||
      status.status === "FAILED" ||
      status.status === "CANCELLED"
    ) {
      return;
    }

    const timer = setInterval(() => {
      void refresh();
    }, 5000);

    return () => clearInterval(timer);
  }, [polledStatus, initialStatus, refresh]);

  const status = polledStatus ?? initialStatus;

  if (!status) {
    return <p className="text-sm text-ardoise/60">{t("migration.noActiveMigration")}</p>;
  }

  const percent = status.progress?.percent ?? 0;
  const isActive = status.status === "QUEUED" || status.status === "RUNNING";
  const isSuccess = status.status === "COMPLETED";
  const isFailed = status.status === "FAILED";
  const isCancelled = status.status === "CANCELLED";

  const statusLabel = t(`migration.status_${status.status}`);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-encre">{statusLabel}</span>
          <span className="text-ardoise/60">{percent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-canal">
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
        {status.progress?.currentFolder ? (
          <p className="text-xs text-ardoise/60">
            {t("migration.currentFolder", { folder: status.progress.currentFolder })}
          </p>
        ) : null}
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
        <ul className="max-h-48 overflow-y-auto divide-y divide-canal">
          {status.events.length === 0 ? (
            <li className="px-4 py-3 text-sm text-ardoise/50">{t("migration.eventsEmpty")}</li>
          ) : (
            status.events.map((event) => (
              <li key={event.id} className="px-4 py-2 text-xs text-ardoise/80">
                <time className="text-ardoise/50">
                  {new Date(event.createdAt).toLocaleTimeString()}
                </time>
                <span className="ml-2">{event.message}</span>
              </li>
            ))
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
