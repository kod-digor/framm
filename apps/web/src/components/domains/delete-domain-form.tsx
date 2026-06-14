"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

function DeleteSubmitButton({ compact, fqdn }: { compact?: boolean; fqdn: string }) {
  const { pending } = useFormStatus();
  const t = useTranslations("domains");

  if (compact) {
    return (
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="size-8 shrink-0 p-0 text-ardoise/60 hover:text-red-600"
        disabled={pending}
        aria-busy={pending}
        aria-label={pending ? t("deleting") : t("deleteAria", { fqdn })}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Trash2 className="size-4" aria-hidden />
        )}
      </Button>
    );
  }

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
  compact = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  domainId: string;
  fqdn: string;
  compact?: boolean;
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
      <DeleteSubmitButton compact={compact} fqdn={fqdn} />
    </form>
  );
}
