"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { EmailDomainInput } from "@/components/ui/email-domain-input";
import { Label } from "@/components/ui/label";

export function AuthEmailField({
  domains,
  id = "email",
}: {
  domains: string[];
  id?: string;
}) {
  const t = useTranslations("auth");
  const [localPart, setLocalPart] = useState("");
  const [domain, setDomain] = useState(domains[0] ?? "");

  const email = useMemo(() => {
    const part = localPart.trim().toLowerCase();
    return part && domain ? `${part}@${domain}` : "";
  }, [localPart, domain]);

  const domainOptions = domains.map((fqdn) => ({ value: fqdn, label: fqdn }));

  return (
    <div>
      <Label htmlFor={`${id}-local`}>{t("email")}</Label>
      <EmailDomainInput
        localPart={localPart}
        onLocalPartChange={setLocalPart}
        localPartName="emailLocal"
        localPartId={`${id}-local`}
        localPartPlaceholder={t("emailLocalPlaceholder")}
        domainValue={domain}
        onDomainChange={setDomain}
        domainName="emailDomain"
        domainId={`${id}-domain`}
        domains={domainOptions}
        domainAriaLabel={t("emailDomainLabel")}
        className="mt-2"
      />
      <input type="hidden" name="email" value={email} />
      <p className="mt-1 text-xs text-zinc-500">
        {t("emailHint", { domain: domain || domains[0] || "" })}
      </p>
    </div>
  );
}
