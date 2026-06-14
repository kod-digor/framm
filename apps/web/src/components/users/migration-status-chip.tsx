"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MigrationStatusPayload } from "@/lib/migration/types";
import { isLaunchedMigrationStatus } from "@/lib/migration/types";
import { formatMigrationPercentLabel } from "@/lib/migration/display";
import { cn } from "@/lib/utils";

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

  if (!isActive) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors",
        "bg-blue-50 text-blue-800 ring-blue-200 hover:bg-blue-100"
      )}
      aria-label={t("migration.statusChipAria", {
        status: t(`migration.status_${status.status}`),
        percent,
      })}
    >
      {isActive ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
      <span>{t(`migration.status_${status.status}`)}</span>
      {isActive ? <span className="tabular-nums">{percentLabel}</span> : null}
    </button>
  );
}
