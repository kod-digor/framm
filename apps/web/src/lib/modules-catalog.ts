import type { OrgModuleFlags } from "@/lib/modules";
import { BarChart3, Calendar, Mail, Users, type LucideIcon } from "lucide-react";

export type ModuleKey = keyof OrgModuleFlags;

export const MODULE_KEYS: ModuleKey[] = ["mail", "calendar", "accounting", "members"];

export type ModuleDefinition = {
  key: ModuleKey;
  icon: LucideIcon;
  /** Module pas encore livré — activation préparatoire uniquement */
  comingSoon: boolean;
  href: string;
};

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  { key: "mail", icon: Mail, comingSoon: false, href: "/dashboard/users" },
  { key: "calendar", icon: Calendar, comingSoon: true, href: "/dashboard/calendar" },
  { key: "accounting", icon: BarChart3, comingSoon: true, href: "/dashboard/accounting" },
  { key: "members", icon: Users, comingSoon: true, href: "/dashboard/members" },
];
