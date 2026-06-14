"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { MigrationSidebarWidget } from "@/components/users/migration-sidebar-widget";
import {
  Activity,
  ChevronRight,
  CreditCard,
  Forward,
  Globe,
  LayoutDashboard,
  Mail,
  Puzzle,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NavItem = {
  id: string;
  href: string;
  label: string;
  icon?: "overview" | "members" | "mail" | "forward" | "globe" | "bureau" | "health" | "modules" | "billing";
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
  health: Activity,
  modules: Puzzle,
  billing: CreditCard,
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
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-encre-muted font-medium text-encre"
          : "text-ardoise/70 hover:bg-neutral-50 hover:text-ardoise"
      )}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-encre" : "text-ardoise/40")} />
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

function subscribeToSectionStorage(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key?.startsWith(STORAGE_PREFIX)) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

function CollapsibleGroup({
  group,
  pathname,
}: {
  group: NavGroup;
  pathname: string;
}) {
  const hasActiveChild = group.items.some((item) => isNavActive(pathname, item.href));
  const persistedOpen = useSyncExternalStore(
    subscribeToSectionStorage,
    () => getStoredSectionOpen(group.id) ?? false,
    () => false,
  );
  const [overrideOpen, setOverrideOpen] = useState<boolean | null>(null);
  const isOpen = hasActiveChild || (overrideOpen !== null ? overrideOpen : persistedOpen);

  const toggle = () => {
    const next = !isOpen;
    setOverrideOpen(next);
    sessionStorage.setItem(`${STORAGE_PREFIX}${group.id}`, String(next));
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ardoise/45 transition-colors hover:text-ardoise/70"
      >
        <ChevronRight
          className={cn("size-3.5 shrink-0 transition-transform duration-200", isOpen && "rotate-90")}
        />
        <span>{group.label}</span>
      </button>
      {isOpen && group.items.length > 0 && (
        <div className="mt-0.5 flex flex-col gap-0.5 pl-1">
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
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-canal bg-white lg:w-60">
      <div className="flex h-16 shrink-0 items-center border-b border-canal px-5">
        <BrandLogo alt={logoAlt} href="/dashboard" size="sm" />
      </div>
      <nav className="flex flex-1 flex-col overflow-y-auto p-3">
        <NavLink item={overview} pathname={pathname} />
        {groups.map((group) => (
          <CollapsibleGroup key={group.id} group={group} pathname={pathname} />
        ))}
      </nav>
      <MigrationSidebarWidget />
    </aside>
  );
}
