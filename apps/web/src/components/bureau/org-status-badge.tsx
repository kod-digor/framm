import type { OrganizationStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const STYLES: Record<OrganizationStatus, string> = {
  PENDING: "bg-amber-50 text-amber-800 ring-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  REJECTED: "bg-red-50 text-red-800 ring-red-200",
};

export function OrgStatusBadge({
  status,
  label,
}: {
  status: OrganizationStatus;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        STYLES[status]
      )}
    >
      {label}
    </span>
  );
}
