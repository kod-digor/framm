"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { addDomainAction } from "@/app/actions/domains";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("domains");

  return (
    <Button type="submit" disabled={pending} className="self-end" aria-busy={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? t("adding") : t("add")}
    </Button>
  );
}

export function AddDomainForm({
  onSuccess,
  onCancel,
}: {
  onSuccess?: (fqdn: string) => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("domains");
  const [state, formAction] = useActionState(addDomainAction, INITIAL_ACTION_RESULT);

  useEffect(() => {
    if (state?.ok && state.detail && onSuccess) onSuccess(state.detail);
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} namespace="domains" paramKey="domain" />
      <div className="space-y-2">
        <Label htmlFor="fqdn">{t("fqdn")}</Label>
        <Input id="fqdn" name="fqdn" placeholder="monasso.bzh" required />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} className="cursor-pointer">
            {t("cancel")}
          </Button>
        ) : null}
        <SubmitButton />
      </div>
    </form>
  );
}
