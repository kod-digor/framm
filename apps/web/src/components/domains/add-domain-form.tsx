"use client";

import { useActionState } from "react";
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

export function AddDomainForm() {
  const t = useTranslations("domains");
  const [state, formAction] = useActionState(addDomainAction, INITIAL_ACTION_RESULT);

  return (
    <form action={formAction} className="space-y-4">
      <FormFeedback state={state} namespace="domains" paramKey="domain" />
      <div className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor="fqdn">{t("fqdn")}</Label>
          <Input id="fqdn" name="fqdn" placeholder="monasso.bzh" required />
        </div>
        <SubmitButton />
      </div>
    </form>
  );
}
