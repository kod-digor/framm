"use client";

import { toggleModuleAction } from "@/app/actions/modules";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { OrgModuleFlags } from "@/lib/modules";
import { MODULE_DEFINITIONS } from "@/lib/modules-catalog";
import { useTranslations } from "next-intl";

export type ModuleConstraints = {
  mailInUse: boolean;
};

export function ModulesPanel({
  modules,
  constraints,
}: {
  modules: OrgModuleFlags;
  constraints: ModuleConstraints;
}) {
  const t = useTranslations("modules");

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {MODULE_DEFINITIONS.map(({ key, icon: Icon, comingSoon }) => {
        const enabled = modules[key];
        const mailLocked = key === "mail" && constraints.mailInUse && enabled;
        const toggleDisabled = mailLocked || (comingSoon && !enabled);

        return (
          <Card key={key} className="border-canal shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <Icon className="size-4 text-encre" aria-hidden />
                {t(`items.${key}.title`)}
                {comingSoon ? (
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-normal text-ardoise/60">
                    {t("comingSoon")}
                  </span>
                ) : null}
              </CardTitle>
              <p className="text-sm text-ardoise/60">{t(`items.${key}.description`)}</p>
              {mailLocked ? (
                <p className="text-xs text-amber-700">{t("mailLocked")}</p>
              ) : null}
            </CardHeader>
            <CardContent>
              <form action={toggleModuleAction} className="flex items-center justify-between gap-4">
                <input type="hidden" name="module" value={key} />
                <Label htmlFor={`module-${key}`} className="text-sm text-ardoise/70">
                  {enabled ? t("enabled") : t("disabled")}
                </Label>
                <Switch
                  id={`module-${key}`}
                  name="enabled"
                  value={enabled ? "false" : "true"}
                  checked={enabled}
                  disabled={toggleDisabled}
                  aria-label={t(`items.${key}.title`)}
                />
              </form>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
