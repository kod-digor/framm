"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { createSharedMailboxAction } from "@/app/actions/shared-mailboxes";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Button } from "@/components/ui/button";
import { EmailDomainInput } from "@/components/ui/email-domain-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  OrgMembersPicker,
  type OrgMemberOption,
} from "@/components/shared-mailboxes/org-members-picker";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  const t = useTranslations("sharedMailboxes");

  return (
    <Button
      type="submit"
      disabled={pending || disabled}
      className="w-full sm:w-auto"
      aria-busy={pending}
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? t("creating") : t("add")}
    </Button>
  );
}

export function CreateSharedMailboxForm({
  domains,
  orgMembers,
  onSuccess,
}: {
  domains: { id: string; fqdn: string; isDnsVerified: boolean }[];
  orgMembers: OrgMemberOption[];
  onSuccess?: () => void;
}) {
  const t = useTranslations("sharedMailboxes");
  const [state, action] = useActionState(createSharedMailboxAction, INITIAL_ACTION_RESULT);
  const [localPart, setLocalPart] = useState("");
  const [domainId, setDomainId] = useState(domains[0]?.id ?? "");
  const [memberIds, setMemberIds] = useState<string[]>([]);

  useEffect(() => {
    if (state?.ok && onSuccess) onSuccess();
  }, [state, onSuccess]);

  return (
    <form action={action} className="space-y-4">
      <FormFeedback state={state} namespace="sharedMailboxes" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="shared-localPart">{t("address")}</Label>
          <EmailDomainInput
            localPart={localPart}
            onLocalPartChange={setLocalPart}
            localPartName="localPart"
            localPartId="shared-localPart"
            localPartPlaceholder="contact"
            domainValue={domainId}
            onDomainChange={setDomainId}
            domainName="domainId"
            domainId="shared-domainId"
            domains={domains.map((d) => ({
              value: d.id,
              label: d.fqdn,
              suffix: d.isDnsVerified ? undefined : t("domainDnsUnverified"),
            }))}
            domainAriaLabel={t("domain")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="shared-displayName">{t("displayName")}</Label>
          <Input id="shared-displayName" name="displayName" />
        </div>

        <div className="sm:col-span-2">
          {orgMembers.length === 0 ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {t("noOrgMembers")}
            </p>
          ) : (
            <OrgMembersPicker
              members={orgMembers}
              selectedIds={memberIds}
              onChange={setMemberIds}
              idPrefix="shared-create"
            />
          )}
        </div>
      </div>

      <SubmitButton disabled={orgMembers.length === 0 || memberIds.length === 0} />
    </form>
  );
}
