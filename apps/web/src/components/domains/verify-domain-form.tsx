"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { verifyDomainAction } from "@/app/actions/domains";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Button } from "@/components/ui/button";
import { INITIAL_ACTION_RESULT, type ActionResult } from "@/lib/action-result";

function VerifySubmitButton({ compact, fqdn }: { compact?: boolean; fqdn?: string }) {
  const { pending } = useFormStatus();
  const t = useTranslations("domains");

  if (compact) {
    return (
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="size-8 shrink-0 p-0 text-ardoise/60 hover:text-encre"
        disabled={pending}
        aria-busy={pending}
        aria-label={pending ? t("verifying") : t("verifyAria", { fqdn: fqdn ?? "" })}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <RefreshCw className="size-4" aria-hidden />
        )}
      </Button>
    );
  }

  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? t("verifying") : t("verify")}
    </Button>
  );
}

export function VerifyDomainForm({
  domainId,
  fqdn,
  compact = false,
  action,
  state,
}: {
  domainId: string;
  fqdn?: string;
  compact?: boolean;
  action?: (formData: FormData) => void | Promise<void>;
  state?: ActionResult;
}) {
  const [internalState, internalAction] = useActionState(verifyDomainAction, INITIAL_ACTION_RESULT);
  const formAction = action ?? internalAction;
  const formState = state ?? internalState;

  const form = (
    <form action={formAction} className={compact ? "inline-flex" : undefined}>
      <input type="hidden" name="domainId" value={domainId} />
      <VerifySubmitButton compact={compact} fqdn={fqdn} />
    </form>
  );

  if (compact) {
    return form;
  }

  return (
    <div className="space-y-3">
      <FormFeedback state={formState} namespace="domains" paramKey="domain" />
      {form}
    </div>
  );
}
