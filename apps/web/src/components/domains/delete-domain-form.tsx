"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

function DeleteSubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("domains");

  return (
    <Button
      type="submit"
      variant="destructive"
      size="sm"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Trash2 className="size-4" />
      )}
      {pending ? t("deleting") : t("delete")}
    </Button>
  );
}

export function DeleteDomainForm({
  action,
  domainId,
  fqdn,
}: {
  action: (formData: FormData) => void | Promise<void>;
  domainId: string;
  fqdn: string;
}) {
  const t = useTranslations("domains");

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!confirm(t("deleteConfirm", { fqdn }))) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="domainId" value={domainId} />
      <DeleteSubmitButton />
    </form>
  );
}
