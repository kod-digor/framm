"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { forceApproveDomainAction } from "@/app/actions/domains";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Button } from "@/components/ui/button";
import { INITIAL_ACTION_RESULT, type ActionResult } from "@/lib/action-result";

function ForceApproveSubmitButton({ fqdn }: { fqdn: string }) {
  const { pending } = useFormStatus();
  const t = useTranslations("domains");

  return (
    <Button
      type="submit"
      variant="outline"
      disabled={pending}
      aria-busy={pending}
      aria-label={pending ? t("forceApproving") : t("forceApproveAria", { fqdn })}
      className="border-ambre text-ambre hover:bg-ambre/10"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <ShieldCheck className="size-4" aria-hidden />
      )}
      {pending ? t("forceApproving") : t("forceApprove")}
    </Button>
  );
}

export function ForceApproveDomainForm({
  domainId,
  fqdn,
  action,
  state,
}: {
  domainId: string;
  fqdn: string;
  action?: (formData: FormData) => void | Promise<void>;
  state?: ActionResult;
}) {
  const t = useTranslations("domains");
  const [internalState, internalAction] = useActionState(
    forceApproveDomainAction,
    INITIAL_ACTION_RESULT
  );
  const formAction = action ?? internalAction;
  const formState = state ?? internalState;

  return (
    <div className="space-y-3 rounded-lg border border-ambre/40 bg-ambre/5 p-4">
      <p className="text-sm text-amber-900">{t("forceApproveHint")}</p>
      <FormFeedback state={formState} namespace="domains" paramKey="domain" />
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!confirm(t("forceApproveConfirm", { fqdn }))) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="domainId" value={domainId} />
        <ForceApproveSubmitButton fqdn={fqdn} />
      </form>
    </div>
  );
}
