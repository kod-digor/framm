"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string };

export function Sidebar({ items, title }: { items: NavItem[]; title: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-zinc-200 bg-zinc-50">
      <div className="border-b border-zinc-200 p-4 font-semibold">{title}</div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors",
              pathname === item.href || pathname.startsWith(item.href + "/")
                ? "bg-zinc-900 text-white"
                : "text-zinc-700 hover:bg-zinc-100"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
