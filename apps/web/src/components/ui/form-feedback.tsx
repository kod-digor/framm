"use client";

import { useTranslations } from "next-intl";
import type messages from "../../../messages/fr.json";
import type { ActionResult } from "@/lib/action-result";

type Namespace = keyof typeof messages;

const variantClasses = {
  success: "border-green-200 bg-green-50 text-green-800",
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
} as const;

export function FormFeedback({
  state,
  namespace,
  paramKey = "detail",
}: {
  state: ActionResult;
  namespace: Namespace;
  paramKey?: string;
}) {
  const t = useTranslations(namespace);

  if (!state?.message) return null;

  const variant = state.warning ? "warning" : state.ok ? "success" : "error";
  const params = state.detail ? { [paramKey]: state.detail } : undefined;
  const translate = t as (key: string, values?: Record<string, string>) => string;

  return (
    <p
      className={`rounded-md border px-4 py-3 text-sm ${variantClasses[variant]}`}
      role="status"
    >
      {translate(state.message, params)}
    </p>
  );
}
