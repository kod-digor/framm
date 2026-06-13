"use client";

import { useCallback, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/t";
import {
  runAllHealthChecksAction,
  runSingleHealthCheckAction,
  type HealthCheckView,
} from "@/app/actions/admin-health";

type HealthPanelProps = {
  checkIds: string[];
  labels: Record<string, { label: string; description: string }>;
};

function StatusDot({ status, loading }: { status?: HealthCheckView["status"]; loading?: boolean }) {
  if (loading) {
    return (
      <span className="flex size-3 shrink-0 items-center justify-center">
        <Loader2 className="size-3 animate-spin text-amber-500" aria-hidden />
      </span>
    );
  }

  const color =
    status === "ok"
      ? "bg-emerald-500"
      : status === "warn"
        ? "bg-amber-500"
        : status === "fail"
          ? "bg-red-500"
          : "bg-zinc-300";

  return (
    <span
      className={cn("size-3 shrink-0 rounded-full", color)}
      aria-hidden
    />
  );
}

function statusLabel(status: HealthCheckView["status"], t: ReturnType<typeof useT>) {
  if (status === "ok") return t("statusOk");
  if (status === "warn") return t("statusWarn");
  return t("statusFail");
}

export function HealthPanel({ checkIds, labels }: HealthPanelProps) {
  const t = useT("adminHealth");
  const [results, setResults] = useState<HealthCheckView[]>([]);
  const [ranAt, setRanAt] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  const mergeResult = useCallback((updated: HealthCheckView) => {
    setResults((prev) => {
      const index = prev.findIndex((item) => item.id === updated.id);
      if (index === -1) return [...prev, updated];
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  }, []);

  const handleRunAll = async () => {
    setRunningAll(true);
    const payload = await runAllHealthChecksAction();
    setResults(payload.results);
    setRanAt(payload.ranAt);
    setRunningAll(false);
  };

  const handleRunSingle = async (checkId: string) => {
    setRunningId(checkId);
    const payload = await runSingleHealthCheckAction(checkId);
    if (payload) {
      mergeResult(payload.result);
      setRanAt(payload.ranAt);
    }
    setRunningId(null);
  };

  const resultMap = new Map(results.map((item) => [item.id, item]));
  const summary = {
    ok: results.filter((r) => r.status === "ok").length,
    warn: results.filter((r) => r.status === "warn").length,
    fail: results.filter((r) => r.status === "fail").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={handleRunAll}
            disabled={runningAll}
            className="min-h-11"
          >
            {runningAll ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {t("runningAll")}
              </>
            ) : (
              t("runAll")
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleRunAll}
            disabled={runningAll}
            className="min-h-11"
          >
            <RefreshCw className="mr-2 size-4" />
            {t("refresh")}
          </Button>
        </div>
        {ranAt && (
          <p className="text-sm text-zinc-500">
            {t("lastRun", { date: new Date(ranAt).toLocaleString("fr-FR") })}
          </p>
        )}
      </div>

      {results.length > 0 && (
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="text-emerald-700">{t("summaryOk", { count: summary.ok })}</span>
          <span className="text-amber-700">{t("summaryWarn", { count: summary.warn })}</span>
          <span className="text-red-700">{t("summaryFail", { count: summary.fail })}</span>
        </div>
      )}

      <div className="grid gap-3">
        {checkIds.map((checkId) => {
          const meta = labels[checkId];
          const result = resultMap.get(checkId);
          const loading = runningAll || runningId === checkId;

          return (
            <Card key={checkId}>
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <StatusDot
                    status={result?.status}
                    loading={loading && (!result || runningAll)}
                  />
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base">{meta.label}</CardTitle>
                    <p className="mt-1 text-sm text-zinc-500">{meta.description}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    disabled={runningAll || runningId !== null}
                    onClick={() => handleRunSingle(checkId)}
                  >
                    {runningId === checkId ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      t("runOne")
                    )}
                  </Button>
                </div>
              </CardHeader>
              {result && (
                <CardContent className="pt-0">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span
                      className={cn(
                        "font-medium",
                        result.status === "ok" && "text-emerald-700",
                        result.status === "warn" && "text-amber-700",
                        result.status === "fail" && "text-red-700"
                      )}
                    >
                      {statusLabel(result.status, t)}
                    </span>
                    <span className="text-zinc-400">{t("duration", { ms: result.durationMs })}</span>
                  </div>
                  {result.detail && (
                    <p className="mt-2 break-words text-sm text-zinc-600">{result.detail}</p>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
