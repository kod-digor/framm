"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChevronRight,
  Forward,
  Globe,
  LayoutDashboard,
  Mail,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NavItem = {
  id: string;
  href: string;
  label: string;
  icon?: "overview" | "members" | "mail" | "forward" | "globe" | "bureau";
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const ICONS: Record<NonNullable<NavItem["icon"]>, LucideIcon> = {
  overview: LayoutDashboard,
  members: Users,
  mail: Mail,
  forward: Forward,
  globe: Globe,
  bureau: ShieldCheck,
};

const STORAGE_PREFIX = "sidebar-section-";

function isNavActive(pathname: string, href: string) {
  if (href === "#") return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isNavActive(pathname, item.href);
  const Icon = ICONS[item.icon ?? "overview"];

  return (
    <Link
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
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function getStoredSectionOpen(groupId: string): boolean | null {
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem(`${STORAGE_PREFIX}${groupId}`);
  if (stored === null) return null;
  return stored === "true";
}

function CollapsibleGroup({
  group,
  pathname,
}: {
  group: NavGroup;
  pathname: string;
}) {
  const hasActiveChild = group.items.some((item) => isNavActive(pathname, item.href));
  const [open, setOpen] = useState(() => getStoredSectionOpen(group.id) ?? false);

  const isOpen = open || hasActiveChild;

  const toggle = () => {
    const next = !isOpen;
    setOpen(next);
    sessionStorage.setItem(`${STORAGE_PREFIX}${group.id}`, String(next));
  };

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
      >
        <ChevronRight
          className={cn(
            "size-4 shrink-0 text-zinc-400 transition-transform duration-200",
            isOpen && "rotate-90"
          )}
        />
        <span>{group.label}</span>
      </button>
      {isOpen && group.items.length > 0 && (
        <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-zinc-100 pl-2">
          {group.items.map((item) => (
            <NavLink key={item.id} item={item} pathname={pathname} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  overview,
  groups,
  logoAlt,
}: {
  overview: NavItem;
  groups: NavGroup[];
  logoAlt: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-zinc-200/80 bg-white">
      <div className="flex h-16 shrink-0 items-center border-b border-zinc-200/80 px-4">
        <Image
          src="/logo-kod-digor.png"
          alt={logoAlt}
          width={1024}
          height={241}
          className="h-10 max-h-10 w-auto max-w-full object-contain"
          priority
        />
      </div>
      <nav className="flex flex-1 flex-col overflow-y-auto p-3">
        <div className="mb-2">
          <NavLink item={overview} pathname={pathname} />
        </div>
        {groups.map((group) => (
          <CollapsibleGroup key={group.id} group={group} pathname={pathname} />
        ))}
      </nav>
    </aside>
  );
}
