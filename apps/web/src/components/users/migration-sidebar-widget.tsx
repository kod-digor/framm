"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { listActiveMigrationsAction } from "@/app/actions/mailbox-migration";
import {
  formatMigrationFolderName,
  getMigrationProgressSummary,
  truncateText,
} from "@/lib/migration/display";
import type { MigrationStatusPayload } from "@/lib/migration/types";
import { isLaunchedMigrationStatus } from "@/lib/migration/types";
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
      const map = await listActiveMigrationsAction();
      if (cancelled) return;
      const list = Object.values(map).filter((m) =>
        isLaunchedMigrationStatus(m.status)
      );
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

  const percent = primary.progress?.percent ?? 0;
  const folder = primary.progress?.currentFolder
    ? truncateText(formatMigrationFolderName(primary.progress.currentFolder), 28)
    : null;
  const extraCount = migrations.length - 1;
  const summary = progressSummaryLabel(t, primary);

  return (
    <div className="shrink-0 border-t border-canal p-3">
      <button
        type="button"
        onClick={() =>
          router.push(
            `/dashboard/users?migrationStatusMailbox=${primary.mailboxId}`
          )
        }
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
            {percent}%
          </span>
        </div>
        <div
          className="mb-2 h-1.5 overflow-hidden rounded-full bg-canal"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("migration.progressAria")}
        >
          <div
            className="h-full bg-encre transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
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
