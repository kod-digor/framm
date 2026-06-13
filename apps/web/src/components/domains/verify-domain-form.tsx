"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { verifyDomainAction } from "@/app/actions/domains";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Button } from "@/components/ui/button";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";

function VerifySubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("domains");

  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? t("verifying") : t("verify")}
    </Button>
  );
}

export function VerifyDomainForm({ domainId }: { domainId: string }) {
  const [state, formAction] = useActionState(verifyDomainAction, INITIAL_ACTION_RESULT);

  return (
    <div className="space-y-3">
      <FormFeedback state={state} namespace="domains" paramKey="domain" />
      <form action={formAction}>
        <input type="hidden" name="domainId" value={domainId} />
        <VerifySubmitButton />
      </form>
    </div>
  );
}
