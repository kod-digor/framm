"use client";

import { useCallback, useEffect, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { updateAliasAction } from "@/app/actions/aliases";
import { FormFeedback } from "@/components/ui/form-feedback";
import { FormDrawer } from "@/components/ui/form-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";

function SaveButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("aliases");

  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? t("saving") : t("save")}
    </Button>
  );
}

function EditAliasFields({
  aliasId,
  source,
  destination,
  onClose,
}: {
  aliasId: string;
  source: string;
  destination: string;
  onClose: () => void;
}) {
  const t = useTranslations("aliases");
  const [state, formAction] = useActionState(updateAliasAction, INITIAL_ACTION_RESULT);
  const [value, setValue] = useState(destination);

  useEffect(() => {
    if (!state?.ok) return;
    onClose();
  }, [state, onClose]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="aliasId" value={aliasId} />
      <FormFeedback state={state} namespace="aliases" paramKey="source" />
      <div className="space-y-2">
        <Label htmlFor={`destination-${aliasId}`}>{t("destination")}</Label>
        <Input
          id={`destination-${aliasId}`}
          name="destination"
          type="email"
          required
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t("destinationPlaceholder")}
        />
        <p className="text-xs text-zinc-500">{t("destinationHint")}</p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">
          {t("cancel")}
        </Button>
        <SaveButton />
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
  const [open, setOpen] = useState(false);
  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <FormDrawer
      open={open}
      onOpenChange={setOpen}
      title={t("edit")}
      description={t("editHint", { source })}
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-8 cursor-pointer p-0 text-zinc-500 hover:text-zinc-900"
          aria-label={t("edit")}
        >
          <Pencil className="size-4" />
        </Button>
      }
    >
      <EditAliasFields
        aliasId={aliasId}
        source={source}
        destination={destination}
        onClose={handleClose}
      />
    </FormDrawer>
  );
}

/** Affiche le bouton d'édition en drawer — alias conservé pour imports existants. */
export function EditAliasDestination(props: {
  aliasId: string;
  source: string;
  destination: string;
}) {
  return <EditAliasForm {...props} />;
}
