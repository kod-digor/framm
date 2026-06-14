"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

function DeleteSubmitButton({ email }: { email: string }) {
  const { pending } = useFormStatus();
  const t = useTranslations("users");

  return (
    <Button
      type="submit"
      variant="ghost"
      size="sm"
      className="size-8 p-0 text-ardoise/60 hover:text-red-600"
      disabled={pending}
      aria-busy={pending}
      aria-label={pending ? t("deleting") : t("deleteAria", { email })}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Trash2 className="size-4" aria-hidden />
      )}
    </Button>
  );
}

export function DeleteWorkspaceUserForm({
  action,
  memberId,
  email,
}: {
  action: (formData: FormData) => void | Promise<void>;
  memberId: string;
  email: string;
}) {
  const t = useTranslations("users");

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!confirm(t("confirmDelete", { email }))) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="memberId" value={memberId} />
      <DeleteSubmitButton email={email} />
    </form>
  );
}
