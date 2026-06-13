"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

function DeleteSubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("aliases");

  return (
    <Button
      type="submit"
      variant="ghost"
      size="sm"
      className="size-8 p-0 text-zinc-500 hover:text-red-600"
      disabled={pending}
      aria-busy={pending}
      aria-label={pending ? t("deleting") : t("delete")}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Trash2 className="size-4" />
      )}
    </Button>
  );
}

export function DeleteAliasForm({
  action,
  aliasId,
  source,
}: {
  action: (formData: FormData) => void | Promise<void>;
  aliasId: string;
  source: string;
}) {
  const t = useTranslations("aliases");

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!confirm(t("deleteConfirm", { source }))) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="aliasId" value={aliasId} />
      <DeleteSubmitButton />
    </form>
  );
}
