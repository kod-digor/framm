"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MigrationStatusPayload } from "@/lib/migration/types";
import { isLaunchedMigrationStatus } from "@/lib/migration/types";
import { formatMigrationPercentLabel } from "@/lib/migration/display";
import { cn } from "@/lib/utils";

const CHIP_STYLES = {
  active: "bg-blue-50 text-blue-800 ring-blue-200 hover:bg-blue-100",
  completed: "bg-green-50 text-green-800 ring-green-200 hover:bg-green-100",
  failed: "bg-red-50 text-red-800 ring-red-200 hover:bg-red-100",
  cancelled: "bg-amber-50 text-amber-900 ring-amber-200 hover:bg-amber-100",
  queued: "bg-blue-50 text-blue-800 ring-blue-200 hover:bg-blue-100",
} as const;

function chipStyleKey(status: MigrationStatusPayload["status"]) {
  if (status === "COMPLETED") return "completed";
  if (status === "FAILED") return "failed";
  if (status === "CANCELLED") return "cancelled";
  if (status === "QUEUED") return "queued";
  return "active";
}

export function MigrationStatusChip({
  status,
  onClick,
}: {
  status: MigrationStatusPayload;
  onClick: () => void;
}) {
  const t = useTranslations("users");
  const percent = status.progress?.percent ?? 0;
  const syncedCount = status.progress?.messagesSynced ?? 0;
  const percentLabel = formatMigrationPercentLabel(percent, syncedCount);
  const isActive = isLaunchedMigrationStatus(status.status);
  const styleKey = chipStyleKey(status.status);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors",
        CHIP_STYLES[styleKey]
      )}
      aria-label={
        isActive
          ? t("migration.statusChipAria", {
              status: t(`migration.status_${status.status}`),
              percent,
            })
          : t("migration.statusChipTerminalAria", {
              status: t(`migration.status_${status.status}`),
            })
      }
    >
      {status.status === "RUNNING" ? (
        <Loader2 className="size-3 animate-spin" aria-hidden />
      ) : status.status === "COMPLETED" ? (
        <CheckCircle2 className="size-3" aria-hidden />
      ) : status.status === "FAILED" ? (
        <XCircle className="size-3" aria-hidden />
      ) : isActive ? (
        <Loader2 className="size-3 animate-spin" aria-hidden />
      ) : null}
      <span>{t(`migration.status_${status.status}`)}</span>
      {isActive ? <span className="tabular-nums">{percentLabel}</span> : null}
    </button>
  );
}
