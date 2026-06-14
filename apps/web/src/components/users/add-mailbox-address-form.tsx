"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { addMailboxAddressAction } from "@/app/actions/workspace-users";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("users");

  return (
    <Button type="submit" size="sm" disabled={pending} aria-busy={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? t("addingAddress") : t("addAddress")}
    </Button>
  );
}

export function AddMailboxAddressForm({
  mailboxId,
  domains,
  onSuccess,
  onCancel,
}: {
  mailboxId: string;
  domains: { id: string; fqdn: string }[];
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("users");
  const [state, action] = useActionState(addMailboxAddressAction, INITIAL_ACTION_RESULT);

  useEffect(() => {
    if (state?.ok && onSuccess) onSuccess();
  }, [state, onSuccess]);

  const [addressOrPattern, setAddressOrPattern] = useState("");
  const [domainId, setDomainId] = useState(domains[0]?.id ?? "");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="mailboxId" value={mailboxId} />
      <input type="hidden" name="domainId" value={domainId} />
      <FormFeedback state={state} namespace="users" />
      <div className="space-y-2">
        <Label htmlFor={`addr-${mailboxId}`}>{t("editDrawer.addressOrPattern")}</Label>
        <Input
          id={`addr-${mailboxId}`}
          name="addressOrPattern"
          value={addressOrPattern}
          onChange={(e) => setAddressOrPattern(e.target.value)}
          placeholder={t("editDrawer.addressOrPatternPlaceholder")}
          autoComplete="off"
          spellCheck={false}
        />
        <p className="text-xs text-ardoise/60">{t("editDrawer.patternHint")}</p>
      </div>
      {domains.length > 1 ? (
        <div className="space-y-2">
          <Label htmlFor={`addr-domain-${mailboxId}`}>{t("editDrawer.patternDomainFallback")}</Label>
          <select
            id={`addr-domain-${mailboxId}`}
            value={domainId}
            onChange={(e) => setDomainId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-canal bg-white px-3 py-1 text-sm text-encre shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fqdn}
              </option>
            ))}
          </select>
          <p className="text-xs text-ardoise/50">{t("editDrawer.patternDomainFallbackHint")}</p>
        </div>
      ) : null}
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
