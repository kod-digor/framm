import { HealthPanel } from "@/components/admin/health-panel";
import { requireAuth } from "@/lib/auth-utils";
import { HEALTH_CHECK_DEFINITIONS } from "@/lib/admin/health-checks";
import { getT } from "@/i18n/t";

export default async function AdminHealthPage() {
  await requireAuth(["BUREAU"]);

  const t = await getT("adminHealth");
  const tr = t as (key: string) => string;
  const checkIds = HEALTH_CHECK_DEFINITIONS.map((def) => def.id);
  const labels = Object.fromEntries(
    checkIds.map((id) => [
      id,
      {
        label: tr(`checks.${id}.label`),
        description: tr(`checks.${id}.description`),
      },
    ])
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>
      </div>

      <HealthPanel checkIds={checkIds} labels={labels} />
    </div>
  );
}
