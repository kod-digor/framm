"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { createWorkspaceUserAction } from "@/app/actions/workspace-users";
import { DnsUnverifiedBanner } from "@/components/ui/dns-unverified-banner";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Button } from "@/components/ui/button";
import { EmailDomainInput } from "@/components/ui/email-domain-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("users");

  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto" aria-busy={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? t("creating") : t("add")}
    </Button>
  );
}

export function CreateWorkspaceUserForm({
  domains,
  onSuccess,
}: {
  domains: { id: string; fqdn: string; isDnsVerified: boolean }[];
  onSuccess?: () => void;
}) {
  const t = useTranslations("users");
  const [state, action] = useActionState(createWorkspaceUserAction, INITIAL_ACTION_RESULT);
  const [localPart, setLocalPart] = useState("");
  const [domainId, setDomainId] = useState(domains[0]?.id ?? "");

  useEffect(() => {
    if (state?.ok && onSuccess) onSuccess();
  }, [state, onSuccess]);

  const selectedDomain = domains.find((d) => d.id === domainId);

  return (
    <form action={action} className="space-y-4">
      <FormFeedback state={state} namespace="users" />

      {selectedDomain && !selectedDomain.isDnsVerified ? (
        <DnsUnverifiedBanner message={t("dnsUnverifiedWarning")} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="user-displayName">{t("displayName")}</Label>
          <Input id="user-displayName" name="displayName" required autoComplete="name" />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="user-localPart">{t("primaryEmail")}</Label>
          <EmailDomainInput
            localPart={localPart}
            onLocalPartChange={setLocalPart}
            localPartName="localPart"
            localPartId="user-localPart"
            localPartPlaceholder="marie.martin"
            domainValue={domainId}
            onDomainChange={setDomainId}
            domainName="domainId"
            domainId="user-domainId"
            domains={domains.map((d) => ({
              value: d.id,
              label: d.fqdn,
              suffix: d.isDnsVerified ? undefined : t("domainDnsUnverified"),
            }))}
            domainAriaLabel={t("domain")}
          />
          <p className="text-xs text-ardoise/50">{t("primaryEmailHint")}</p>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="user-password">{t("tempPassword")}</Label>
          <Input
            id="user-password"
            name="password"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
          />
          <p className="text-xs text-ardoise/50">{t("tempPasswordHint")}</p>
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}
