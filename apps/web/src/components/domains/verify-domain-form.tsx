"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

function VerifySubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("domains");

  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? t("verifying") : t("verify")}
    </Button>
  );
}

export function VerifyDomainForm({
  action,
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action}>
      <VerifySubmitButton />
    </form>
  );
}
