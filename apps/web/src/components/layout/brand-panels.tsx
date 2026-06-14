import Link from "next/link";
import { cn } from "@/lib/utils";

export type ServiceStatusItem = {
  id: string;
  label: string;
  value: string;
  href?: string;
  tone: "neutral" | "ok" | "attention";
};

const toneDot: Record<ServiceStatusItem["tone"], string> = {
  ok: "bg-verin",
  attention: "bg-ambre",
  neutral: "bg-encre/30",
};

export function ServiceStatusPanel({
  title,
  items,
}: {
  title: string;
  items: ServiceStatusItem[];
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-ardoise/60">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((item) => {
          const inner = (
            <>
              <div className="flex items-center gap-2">
                <span className={cn("size-1.5 rounded-full", toneDot[item.tone])} aria-hidden />
                <p className="text-xs text-ardoise/50">{item.label}</p>
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-ardoise">{item.value}</p>
            </>
          );

          const className =
            "rounded-lg border border-canal bg-white px-4 py-3 transition-colors hover:border-encre/20";

          return item.href ? (
            <Link key={item.id} href={item.href} className={className}>
              {inner}
            </Link>
          ) : (
            <div key={item.id} className={className}>
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}
