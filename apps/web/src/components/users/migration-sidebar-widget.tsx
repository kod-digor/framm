"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { listRecentMigrationsAction } from "@/app/actions/mailbox-migration";
import {
  formatMigrationFolderName,
  formatMigrationPercentLabel,
  formatRelativeTimeFr,
  getMigrationProgressBarWidth,
  getMigrationProgressSummary,
  truncateText,
} from "@/lib/migration/display";
import type { MigrationStatusPayload } from "@/lib/migration/types";
import {
  isLaunchedMigrationStatus,
  isSidebarVisibleMigration,
} from "@/lib/migration/types";
import { cn } from "@/lib/utils";

function progressSummaryLabel(
  t: ReturnType<typeof useTranslations<"users">>,
  status: MigrationStatusPayload
): string {
  const summary = getMigrationProgressSummary(status);
  if (summary.kind === "messages") {
    return t("migration.sidebarProgressMessages", {
      synced: summary.synced,
      total: summary.total,
    });
  }
  if (summary.kind === "contacts") {
    return t("migration.progressContacts", {
      synced: summary.synced,
      total: summary.total,
    });
  }
  if (summary.kind === "calendar") {
    return t("migration.progressCalendar", {
      synced: summary.synced,
      total: summary.total,
    });
  }
  if (summary.phase) {
    return t(`migration.phase_${summary.phase}`);
  }
  return t(`migration.status_${status.status}`);
}

export function MigrationSidebarWidget() {
  const t = useTranslations("users");
  const router = useRouter();
  const [migrations, setMigrations] = useState<MigrationStatusPayload[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const map = await listRecentMigrationsAction();
      if (cancelled) return;
      const list = Object.values(map).filter(isSidebarVisibleMigration);
      list.sort((a, b) => {
        const aActive = isLaunchedMigrationStatus(a.status);
        const bActive = isLaunchedMigrationStatus(b.status);
        if (aActive !== bActive) return aActive ? -1 : 1;
        const aTime = a.completedAt ?? a.startedAt ?? "";
        const bTime = b.completedAt ?? b.startedAt ?? "";
        return bTime.localeCompare(aTime);
      });
      setMigrations(list);
    }

    void load();
    const timer = setInterval(() => void load(), 5000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const primary = migrations[0];
  if (!primary) return null;

  const isActive = isLaunchedMigrationStatus(primary.status);
  const percent = primary.progress?.percent ?? 0;
  const summary = progressSummaryLabel(t, primary);
  const progressSummary = getMigrationProgressSummary(primary);
  const syncedCount =
    progressSummary.kind === "messages" ? progressSummary.synced : 0;
  const percentLabel = formatMigrationPercentLabel(percent, syncedCount);
  const progressBarWidth = getMigrationProgressBarWidth(percent, syncedCount);
  const folder = primary.progress?.currentFolder
    ? truncateText(formatMigrationFolderName(primary.progress.currentFolder), 28)
    : null;
  const extraCount = migrations.length - 1;
  const completedAtLabel = primary.completedAt
    ? formatRelativeTimeFr(primary.completedAt)
    : null;

  const openDetail = () =>
    router.push(`/dashboard/users?migrationStatusMailbox=${primary.mailboxId}`);

  if (!isActive) {
    const isSuccess = primary.status === "COMPLETED";
    return (
      <div className="shrink-0 border-t border-canal p-3">
        <button
          type="button"
          onClick={openDetail}
          className={cn(
            "w-full rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-encre/30",
            isSuccess
              ? "border-green-200 bg-green-50/80 hover:border-green-300 hover:bg-green-50"
              : "border-red-200 bg-red-50/80 hover:border-red-300 hover:bg-red-50"
          )}
          aria-label={t("migration.sidebarRecentAria", {
            status: t(`migration.status_${primary.status}`),
          })}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span
              className={cn(
                "flex items-center gap-1.5 text-xs font-semibold",
                isSuccess ? "text-green-900" : "text-red-900"
              )}
            >
              {isSuccess ? (
                <CheckCircle2 className="size-3.5" aria-hidden />
              ) : (
                <XCircle className="size-3.5" aria-hidden />
              )}
              {t("migration.sidebarRecentTitle")}
            </span>
            <span className="text-xs font-medium text-ardoise/70">
              {t(`migration.status_${primary.status}`)}
            </span>
          </div>
          <p className="truncate text-xs text-ardoise/80">{primary.targetAddress}</p>
          {completedAtLabel ? (
            <p className="mt-0.5 text-xs text-ardoise/50">
              {t("migration.completedAtLabel", { when: completedAtLabel })}
            </p>
          ) : null}
          {extraCount > 0 ? (
            <p className="mt-1 text-xs text-ardoise/50">
              {t("migration.sidebarMultiple", { count: extraCount })}
            </p>
          ) : null}
        </button>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-canal p-3">
      <button
        type="button"
        onClick={openDetail}
        className={cn(
          "w-full rounded-lg border border-canal bg-neutral-50/80 p-3 text-left transition-colors",
          "hover:border-encre/20 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-encre/30"
        )}
        aria-label={t("migration.sidebarAria", { percent })}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-encre">
            <Loader2 className="size-3 animate-spin" aria-hidden />
            {t("migration.sidebarTitle")}
          </span>
          <span className="text-xs font-medium tabular-nums text-ardoise/70">
            {percentLabel}
          </span>
        </div>
        <div
          className="mb-2 h-1.5 overflow-hidden rounded-full bg-canal"
          role="progressbar"
          aria-valuenow={syncedCount > 0 && percent === 0 ? 1 : percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("migration.progressAria")}
        >
          <div
            className="h-full bg-encre transition-all duration-500"
            style={{ width: `${progressBarWidth}%` }}
          />
        </div>
        <p className="truncate text-xs text-ardoise/80">{summary}</p>
        {folder ? (
          <p className="mt-0.5 truncate text-xs text-ardoise/50">
            {t("migration.folderLabel", { folder })}
          </p>
        ) : null}
        {extraCount > 0 ? (
          <p className="mt-1 text-xs text-ardoise/50">
            {t("migration.sidebarMultiple", { count: extraCount })}
          </p>
        ) : null}
      </button>
    </div>
  );
}
