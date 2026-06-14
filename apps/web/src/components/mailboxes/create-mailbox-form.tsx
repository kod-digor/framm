"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { createMailboxAction } from "@/app/actions/mailboxes";
import { DnsUnverifiedBanner } from "@/components/ui/dns-unverified-banner";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Button } from "@/components/ui/button";
import { EmailDomainInput } from "@/components/ui/email-domain-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("mailboxes");

  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto" aria-busy={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? t("creating") : t("add")}
    </Button>
  );
}

function CreateMailboxFields({
  domains,
}: {
  domains: { id: string; fqdn: string; isDnsVerified: boolean }[];
}) {
  const t = useTranslations("mailboxes");
  const [localPart, setLocalPart] = useState("");
  const [domainId, setDomainId] = useState(domains[0]?.id ?? "");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");

  const selectedDomain = domains.find((domain) => domain.id === domainId);
  const showDnsWarning = selectedDomain && !selectedDomain.isDnsVerified;

  return (
    <>
      {showDnsWarning && <DnsUnverifiedBanner message={t("dnsUnverifiedWarning")} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="localPart">{t("localPart")}</Label>
          <EmailDomainInput
            localPart={localPart}
            onLocalPartChange={setLocalPart}
            localPartName="localPart"
            localPartId="localPart"
            localPartPlaceholder="info"
            domainValue={domainId}
            onDomainChange={setDomainId}
            domainName="domainId"
            domainId="domainId"
            domains={domains.map((domain) => ({
              value: domain.id,
              label: domain.fqdn,
              suffix: domain.isDnsVerified ? undefined : t("domainDnsUnverified"),
            }))}
            domainAriaLabel={t("domain")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="displayName">{t("displayName")}</Label>
          <Input
            id="displayName"
            name="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t("displayNamePlaceholder")}
          />
          <p className="text-xs text-zinc-500">{t("displayNameHint")}</p>
        </div>

        <div className="space-y-2 sm:col-span-2 sm:max-w-md">
          <Label htmlFor="password">{t("password")}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
            placeholder={t("passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs text-zinc-500">{t("passwordHint")}</p>
        </div>
      </div>
    </>
  );
}

export function CreateMailboxForm({
  domains,
  onSuccess,
}: {
  domains: { id: string; fqdn: string; isDnsVerified: boolean }[];
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState(createMailboxAction, INITIAL_ACTION_RESULT);

  useEffect(() => {
    if (state?.ok && onSuccess) onSuccess();
  }, [state, onSuccess]);
  const fieldsKey =
    state?.ok && state.message === "created" && state.detail
      ? `created-${state.detail}`
      : "idle";

  return (
    <form action={formAction} className="space-y-5">
      <FormFeedback state={state} namespace="mailboxes" paramKey="address" />
      <CreateMailboxFields key={fieldsKey} domains={domains} />
      <SubmitButton />
    </form>
  );
}
