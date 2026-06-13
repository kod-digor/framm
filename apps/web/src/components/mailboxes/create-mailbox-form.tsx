"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmailDomainInput } from "@/components/ui/email-domain-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

export function CreateMailboxForm({
  action,
  domains,
}: {
  action: (formData: FormData) => void | Promise<void>;
  domains: { id: string; fqdn: string }[];
}) {
  const t = useTranslations("mailboxes");
  const [localPart, setLocalPart] = useState("");
  const [domainId, setDomainId] = useState(domains[0]?.id ?? "");

  const selectedDomain = domains.find((d) => d.id === domainId);
  const preview = useMemo(() => {
    const part = localPart.trim() || "contact";
    return selectedDomain ? `${part}@${selectedDomain.fqdn}` : part;
  }, [localPart, selectedDomain]);

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="localPart">{t("localPart")}</Label>
          <EmailDomainInput
            localPart={localPart}
            onLocalPartChange={setLocalPart}
            localPartName="localPart"
            localPartId="localPart"
            localPartPlaceholder="contact"
            domainValue={domainId}
            onDomainChange={setDomainId}
            domainName="domainId"
            domainId="domainId"
            domains={domains.map((domain) => ({
              value: domain.id,
              label: domain.fqdn,
            }))}
            domainAriaLabel={t("domain")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t("password")}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
            placeholder="••••••••"
          />
          <p className="text-xs text-zinc-500">{t("passwordHint")}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm">
        <Mail className="size-4 shrink-0 text-zinc-400" />
        <p className="text-zinc-600">
          {t("preview")}{" "}
          <code className="rounded bg-white px-2 py-0.5 font-mono text-zinc-900">{preview}</code>
        </p>
      </div>

      <SubmitButton />
    </form>
  );
}
