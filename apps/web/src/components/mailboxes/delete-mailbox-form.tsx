"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

function DeleteSubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("mailboxes");

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

export function DeleteMailboxForm({
  action,
  mailboxId,
  address,
}: {
  action: (formData: FormData) => void | Promise<void>;
  mailboxId: string;
  address: string;
}) {
  const t = useTranslations("mailboxes");

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!confirm(t("deleteConfirm", { address }))) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="mailboxId" value={mailboxId} />
      <DeleteSubmitButton />
    </form>
  );
}
