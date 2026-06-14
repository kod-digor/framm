"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { updateMailboxAction } from "@/app/actions/mailboxes";
import { FormFeedback } from "@/components/ui/form-feedback";
import { FormEditDialog } from "@/components/ui/form-edit-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";

const BYTES_PER_GB = 1_073_741_824;

function quotaBytesToGb(quotaBytes: number | null): string {
  if (quotaBytes == null) return "";
  const gb = quotaBytes / BYTES_PER_GB;
  return Number.isInteger(gb) ? String(gb) : gb.toFixed(1);
}

function SaveButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("mailboxes");

  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? t("saving") : t("save")}
    </Button>
  );
}

function EditMailboxFields({
  mailboxId,
  address,
  displayName,
  quotaBytes,
  onClose,
}: {
  mailboxId: string;
  address: string;
  displayName: string | null;
  quotaBytes: number | null;
  onClose: () => void;
}) {
  const t = useTranslations("mailboxes");
  const [state, formAction] = useActionState(updateMailboxAction, INITIAL_ACTION_RESULT);
  const [name, setName] = useState(displayName ?? "");
  const [password, setPassword] = useState("");
  const [quotaUnlimited, setQuotaUnlimited] = useState(quotaBytes == null);
  const [quotaGb, setQuotaGb] = useState(quotaBytesToGb(quotaBytes));

  useEffect(() => {
    if (!state?.ok) return;
    onClose();
  }, [state, onClose]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="mailboxId" value={mailboxId} />
      <FormFeedback state={state} namespace="mailboxes" paramKey="address" />

      <div className="space-y-2">
        <Label htmlFor={`displayName-${mailboxId}`}>{t("displayName")}</Label>
        <Input
          id={`displayName-${mailboxId}`}
          name="displayName"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("displayNamePlaceholder")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`password-${mailboxId}`}>{t("newPassword")}</Label>
        <Input
          id={`password-${mailboxId}`}
          name="password"
          type="password"
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
        />
        <p className="text-xs text-zinc-500">{t("newPasswordHint")}</p>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">{t("quotaLimit")}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="quotaUnlimited"
            checked={quotaUnlimited}
            onChange={(event) => setQuotaUnlimited(event.target.checked)}
            className="size-4 rounded border-zinc-300"
          />
          {t("quotaUnlimited")}
        </label>
        {!quotaUnlimited ? (
          <div className="space-y-2">
            <Label htmlFor={`quotaGb-${mailboxId}`}>{t("quotaGb")}</Label>
            <Input
              id={`quotaGb-${mailboxId}`}
              name="quotaGb"
              type="number"
              min={0.1}
              step={0.1}
              inputMode="decimal"
              value={quotaGb}
              onChange={(event) => setQuotaGb(event.target.value)}
              placeholder="5"
            />
            <p className="text-xs text-zinc-500">{t("quotaGbHint")}</p>
          </div>
        ) : null}
      </fieldset>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          {t("cancel")}
        </Button>
        <SaveButton />
      </div>
      <p className="text-xs text-zinc-500">{t("editHint", { address })}</p>
    </form>
  );
}

export function EditMailboxForm({
  mailboxId,
  address,
  displayName,
  quotaBytes,
}: {
  mailboxId: string;
  address: string;
  displayName: string | null;
  quotaBytes: number | null;
}) {
  const t = useTranslations("mailboxes");
  const [open, setOpen] = useState(false);
  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <FormEditDialog
      open={open}
      onOpenChange={setOpen}
      title={t("editTitle")}
      description={t("editHint", { address })}
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-8 p-0 text-zinc-500 hover:text-zinc-900"
          aria-label={t("edit")}
        >
          <Pencil className="size-4" />
        </Button>
      }
    >
      <EditMailboxFields
        mailboxId={mailboxId}
        address={address}
        displayName={displayName}
        quotaBytes={quotaBytes}
        onClose={handleClose}
      />
    </FormEditDialog>
  );
}
