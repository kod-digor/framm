"use server";

import { requireAuth } from "@/lib/auth-utils";
import {
  findHealthCheckDefinition,
  runAllHealthChecks,
  runHealthCheck,
} from "@/lib/admin/health-checks";
import { enrichHealthResults, type HealthCheckView } from "@/lib/admin/health-present";

export type { HealthCheckView };

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
    results: await enrichHealthResults(results),
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
  const [view] = await enrichHealthResults([result]);
  return { result: view, ranAt: new Date().toISOString() };
}
