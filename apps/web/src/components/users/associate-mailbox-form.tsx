"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { associateMailboxAction } from "@/app/actions/workspace-users";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("users");

  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? t("associatingMailbox") : t("associateMailbox")}
    </Button>
  );
}

export function AssociateMailboxForm({
  memberId,
  userEmail,
  onSuccess,
  onCancel,
}: {
  memberId: string;
  userEmail: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("users");
  const [state, action] = useActionState(associateMailboxAction, INITIAL_ACTION_RESULT);

  useEffect(() => {
    if (state?.ok && onSuccess) onSuccess();
  }, [state, onSuccess]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="memberId" value={memberId} />
      <FormFeedback state={state} namespace="users" />

      <div className="space-y-2">
        <Label>{t("associateMailboxAddress")}</Label>
        <p className="font-mono-data text-sm text-encre">{userEmail}</p>
        <p className="text-xs text-ardoise/50">{t("associateMailboxHint")}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`associate-pwd-${memberId}`}>{t("tempPassword")}</Label>
        <Input
          id={`associate-pwd-${memberId}`}
          name="password"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
        />
        <p className="text-xs text-ardoise/50">{t("associatePasswordHint")}</p>
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
