"use client";

import type { ProductStatus } from "@/lib/products-catalog";
import { useT } from "@/i18n/t";

const STATUS_STYLES: Record<ProductStatus, string> = {
  live: "bg-verin/10 text-verin",
  beta: "bg-encre/10 text-encre",
  in_progress: "bg-encre/10 text-encre",
  planned: "bg-neutral-100 text-ardoise/60",
  research: "bg-ambre/10 text-ambre",
};

type ProductStatusBadgeProps = {
  status: ProductStatus;
};

export function ProductStatusBadge({ status }: ProductStatusBadgeProps) {
  const t = useT("roadmap");

  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {t(`status.${status}`)}
    </span>
  );
}
