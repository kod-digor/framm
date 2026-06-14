import { getT } from "@/i18n/t";
import type { HealthCheckResult } from "@/lib/admin/health-checks";

export type HealthCheckView = HealthCheckResult & {
  label: string;
  description: string;
};

export async function enrichHealthResults(results: HealthCheckResult[]): Promise<HealthCheckView[]> {
  const t = await getT("adminHealth");
  const tr = t as (key: string) => string;
  return results.map((result) => ({
    ...result,
    label: tr(`checks.${result.id}.label`),
    description: tr(`checks.${result.id}.description`),
  }));
}
