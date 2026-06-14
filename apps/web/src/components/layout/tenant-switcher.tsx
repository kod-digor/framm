"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { switchTenantAction, logoutAction } from "@/app/actions/tenant";
import { Button } from "@/components/ui/button";
import {
  Check,
  ChevronDown,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Tenant = {
  id: string;
  name: string;
  status: string;
};

export function TenantSwitcher({
  tenants,
  activeTenantId,
  userEmail,
}: {
  tenants: Tenant[];
  activeTenantId: string | null;
  userEmail: string;
}) {
  const t = useTranslations("tenant");
  const active = tenants.find((tenant) => tenant.id === activeTenantId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-[220px] justify-between gap-2">
          <span className="truncate">{active?.name ?? t("select")}</span>
          <ChevronDown className="size-4 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-1.5">
          <p className="truncate text-xs text-zinc-500">{userEmail}</p>
        </div>
        <DropdownMenuSeparator />
        <p className="px-2 py-1 text-xs font-medium tracking-wide text-zinc-400">
          {t("associations")}
        </p>
        {tenants.map((tenant) => {
          const isActive = tenant.id === activeTenantId;

          return (
            <DropdownMenuItem
              key={tenant.id}
              disabled={false}
              onSelect={() => {
                if (isActive) return;
                void switchTenantAction(tenant.id);
              }}
            >
              <span className="flex-1 truncate">{tenant.name}</span>
              {tenant.status === "PENDING" && (
                <span className="ml-2 text-xs text-amber-600">{t("pending")}</span>
              )}
              {isActive && <Check className="ml-2 size-4 shrink-0" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/signup" className="cursor-pointer">
            {t("addAssociation")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void logoutAction();
          }}
          className="text-red-600 focus:text-red-600"
        >
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
