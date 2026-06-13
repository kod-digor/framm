"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { createAliasAction } from "@/app/actions/aliases";
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

export function CreateAliasForm({
  domains,
}: {
  domains: { id: string; fqdn: string }[];
}) {
  const t = useTranslations("aliases");
  const [state, formAction] = useActionState(createAliasAction, INITIAL_ACTION_RESULT);
  const [localPart, setLocalPart] = useState("");
  const [domainId, setDomainId] = useState(domains[0]?.id ?? "");
  const [destination, setDestination] = useState("");

  useEffect(() => {
    if (state?.ok && state.message === "created") {
      setLocalPart("");
      setDestination("");
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-5">
      <FormFeedback state={state} namespace="aliases" paramKey="source" />

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

      <SubmitButton />
    </form>
  );
}
