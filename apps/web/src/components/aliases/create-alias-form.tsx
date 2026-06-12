"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  action,
  domains,
}: {
  action: (formData: FormData) => void | Promise<void>;
  domains: { id: string; fqdn: string }[];
}) {
  const t = useTranslations("aliases");
  const [localPart, setLocalPart] = useState("");
  const [domainId, setDomainId] = useState(domains[0]?.id ?? "");
  const [destination, setDestination] = useState("");

  const selectedDomain = domains.find((d) => d.id === domainId);
  const sourcePreview = useMemo(() => {
    const part = localPart.trim() || "info";
    return selectedDomain ? `${part}@${selectedDomain.fqdn}` : part;
  }, [localPart, selectedDomain]);

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="localPart">{t("sourceLocal")}</Label>
          <div className="flex rounded-md border border-zinc-200 bg-white focus-within:ring-2 focus-within:ring-zinc-900 focus-within:ring-offset-2">
            <Input
              id="localPart"
              name="localPart"
              placeholder="info"
              required
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              value={localPart}
              onChange={(e) => setLocalPart(e.target.value)}
            />
            <span className="flex items-center border-l border-zinc-200 px-3 text-sm text-zinc-500">
              @
            </span>
            <select
              id="domainId"
              name="domainId"
              required
              value={domainId}
              onChange={(e) => setDomainId(e.target.value)}
              className="min-w-0 flex-1 rounded-r-md border-0 bg-transparent px-2 text-sm outline-none"
            >
              {domains.map((domain) => (
                <option key={domain.id} value={domain.id}>
                  {domain.fqdn}
                </option>
              ))}
            </select>
          </div>
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

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm">
        <Mail className="size-4 shrink-0 text-zinc-400" />
        <code className="rounded bg-white px-2 py-0.5 font-mono text-zinc-900">{sourcePreview}</code>
        <ArrowRight className="size-4 text-zinc-400" />
        <span className="text-zinc-600">{destination || t("destinationPlaceholder")}</span>
      </div>

      <SubmitButton />
    </form>
  );
}
