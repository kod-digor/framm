"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Forward,
  Globe,
  LayoutDashboard,
  Mail,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string };
type NavSection = { label?: string; items: NavItem[] };

const ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/dashboard/domains": Globe,
  "/dashboard/mailboxes": Mail,
  "/dashboard/aliases": Forward,
  "/dashboard/usage": BarChart3,
  "/bureau": ShieldCheck,
};

function isNavActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  sections,
  title,
  tagline,
}: {
  sections: NavSection[];
  title: string;
  tagline?: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-zinc-200/80 bg-white">
      <div className="border-b border-zinc-100 px-5 py-5">
        <p className="text-base font-semibold tracking-tight text-zinc-900">{title}</p>
        {tagline && <p className="mt-0.5 text-xs text-zinc-500">{tagline}</p>}
      </div>
      <nav className="flex flex-1 flex-col p-3">
        {sections.map((section, sectionIndex) => (
          <div key={section.label ?? `section-${sectionIndex}`} className={cn(sectionIndex > 0 && "mt-4")}>
            {section.label && (
              <p className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                {section.label}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = isNavActive(pathname, item.href);
                const Icon = ICONS[item.href] ?? LayoutDashboard;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-zinc-900 text-white shadow-sm"
                        : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                    )}
                  >
                    <Icon
                      className={cn("size-4 shrink-0", active ? "text-white" : "text-zinc-400")}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
