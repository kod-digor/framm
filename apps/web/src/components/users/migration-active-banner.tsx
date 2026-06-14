"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

export function MigrationActiveBanner({ count }: { count: number }) {
  const t = useTranslations("users");

  if (count <= 0) return null;

  return (
    <p
      className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"
      role="status"
    >
      <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
      {t("migration.activeBanner", { count })}
    </p>
  );
}
