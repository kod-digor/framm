import { cn } from "@/lib/utils";

export function AliasStatusBadge({ label }: { label: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200"
      )}
    >
      {label}
    </span>
  );
}
