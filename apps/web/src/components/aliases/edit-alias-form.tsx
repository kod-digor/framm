"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Pencil, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { updateAliasAction } from "@/app/actions/aliases";
import { AliasEmailBadge } from "@/components/aliases/alias-email-badge";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";

function SaveButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("aliases");

  return (
    <Button type="submit" size="sm" disabled={pending} aria-busy={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? t("saving") : t("save")}
    </Button>
  );
}

export function EditAliasDestination({
  aliasId,
  source,
  destination,
}: {
  aliasId: string;
  source: string;
  destination: string;
}) {
  const t = useTranslations("aliases");
  const [state, formAction] = useActionState(updateAliasAction, INITIAL_ACTION_RESULT);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(destination);

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <AliasEmailBadge email={destination} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-8 shrink-0 p-0 text-zinc-500 hover:text-zinc-900"
          onClick={() => setEditing(true)}
          aria-label={t("edit")}
        >
          <Pencil className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2"
      onSubmit={() => setEditing(false)}
    >
      <input type="hidden" name="aliasId" value={aliasId} />
      <FormFeedback state={state} namespace="aliases" paramKey="source" />
      <Input
        name="destination"
        type="email"
        required
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t("destinationPlaceholder")}
        className="h-9 font-mono text-sm"
        aria-label={t("destination")}
      />
      <div className="flex flex-wrap items-center gap-2">
        <SaveButton />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setValue(destination);
            setEditing(false);
          }}
        >
          <X className="size-4" />
          {t("cancel")}
        </Button>
      </div>
      <p className="text-xs text-zinc-500">{t("editHint", { source })}</p>
    </form>
  );
}

export function EditAliasForm({
  aliasId,
  source,
  destination,
}: {
  aliasId: string;
  source: string;
  destination: string;
}) {
  const t = useTranslations("aliases");
  const [state, formAction] = useActionState(updateAliasAction, INITIAL_ACTION_RESULT);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(destination);

  if (!editing) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="size-8 p-0 text-zinc-500 hover:text-zinc-900"
        onClick={() => setEditing(true)}
        aria-label={t("edit")}
      >
        <Pencil className="size-4" />
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex min-w-0 flex-col gap-2"
      onSubmit={() => setEditing(false)}
    >
      <input type="hidden" name="aliasId" value={aliasId} />
      <FormFeedback state={state} namespace="aliases" paramKey="source" />
      <Input
        name="destination"
        type="email"
        required
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t("destinationPlaceholder")}
        className="h-9 font-mono text-sm"
        aria-label={t("destination")}
      />
      <div className="flex items-center gap-2">
        <SaveButton />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setValue(destination);
            setEditing(false);
          }}
        >
          <X className="size-4" />
          {t("cancel")}
        </Button>
      </div>
      <p className="text-xs text-zinc-500">{t("editHint", { source })}</p>
    </form>
  );
}
