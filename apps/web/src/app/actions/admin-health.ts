"use server";

import { requireAuth } from "@/lib/auth-utils";
import {
  findHealthCheckDefinition,
  runAllHealthChecks,
  runHealthCheck,
  type HealthCheckResult,
} from "@/lib/admin/health-checks";
import { getT } from "@/i18n/t";

export type HealthCheckView = HealthCheckResult & {
  label: string;
  description: string;
};

async function enrichResults(results: HealthCheckResult[]): Promise<HealthCheckView[]> {
  const t = await getT("adminHealth");
  const tr = t as (key: string) => string;
  return results.map((result) => ({
    ...result,
    label: tr(`checks.${result.id}.label`),
    description: tr(`checks.${result.id}.description`),
  }));
}

async function bureauContext() {
  const session = await requireAuth(["BUREAU"]);
  return {
    sessionEmail: session.user.email,
    sessionRole: session.user.role,
  };
}

export async function runAllHealthChecksAction(): Promise<{
  results: HealthCheckView[];
  ranAt: string;
}> {
  const ctx = await bureauContext();
  const results = await runAllHealthChecks(ctx);
  return {
    results: await enrichResults(results),
    ranAt: new Date().toISOString(),
  };
}

export async function runSingleHealthCheckAction(
  checkId: string
): Promise<{ result: HealthCheckView; ranAt: string } | null> {
  const definition = findHealthCheckDefinition(checkId);
  if (!definition) return null;

  const ctx = await bureauContext();
  const result = await runHealthCheck(definition, ctx);
  const [view] = await enrichResults([result]);
  return { result: view, ranAt: new Date().toISOString() };
}
