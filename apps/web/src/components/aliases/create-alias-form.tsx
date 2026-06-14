"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { createAliasAction } from "@/app/actions/aliases";
import { DnsUnverifiedBanner } from "@/components/ui/dns-unverified-banner";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Button } from "@/components/ui/button";
import { EmailDomainInput } from "@/components/ui/email-domain-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("aliases");

  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto" aria-busy={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? t("creating") : t("add")}
    </Button>
  );
}

function CreateAliasFields({
  domains,
}: {
  domains: { id: string; fqdn: string; isDnsVerified: boolean }[];
}) {
  const t = useTranslations("aliases");
  const [localPart, setLocalPart] = useState("");
  const [domainId, setDomainId] = useState(domains[0]?.id ?? "");
  const [destination, setDestination] = useState("");

  const selectedDomain = domains.find((domain) => domain.id === domainId);
  const showDnsWarning = selectedDomain && !selectedDomain.isDnsVerified;

  return (
    <>
      {showDnsWarning && <DnsUnverifiedBanner message={t("dnsUnverifiedWarning")} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="localPart">{t("sourceLocal")}</Label>
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
            domainAriaLabel={t("sourceLocal")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="destination">{t("destination")}</Label>
          <Input
            id="destination"
            name="destination"
            type="email"
            placeholder="contact@monasso.bzh"
            required
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
          <p className="text-xs text-zinc-500">{t("destinationHint")}</p>
        </div>
      </div>
    </>
  );
}

export function CreateAliasForm({
  domains,
  onSuccess,
}: {
  domains: { id: string; fqdn: string; isDnsVerified: boolean }[];
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState(createAliasAction, INITIAL_ACTION_RESULT);

  useEffect(() => {
    if (state?.ok && onSuccess) onSuccess();
  }, [state, onSuccess]);
  const fieldsKey =
    state?.ok && state.message === "created" && state.detail
      ? `created-${state.detail}`
      : "idle";

  return (
    <form action={formAction} className="space-y-5">
      <FormFeedback state={state} namespace="aliases" paramKey="source" />
      <CreateAliasFields key={fieldsKey} domains={domains} />
      <SubmitButton />
    </form>
  );
}
