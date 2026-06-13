"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Pencil, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { updateMailboxAction } from "@/app/actions/mailboxes";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";

function SaveButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("mailboxes");

  return (
    <Button type="submit" size="sm" disabled={pending} aria-busy={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? t("saving") : t("save")}
    </Button>
  );
}

function EditMailboxFields({
  mailboxId,
  address,
  displayName,
  onCancel,
}: {
  mailboxId: string;
  address: string;
  displayName: string | null;
  onCancel: () => void;
}) {
  const t = useTranslations("mailboxes");
  const [state, formAction] = useActionState(updateMailboxAction, INITIAL_ACTION_RESULT);
  const [name, setName] = useState(displayName ?? "");
  const [password, setPassword] = useState("");

  return (
    <form
      action={formAction}
      className="flex min-w-0 flex-col gap-3"
      onSubmit={() => {
        setPassword("");
        onCancel();
      }}
    >
      <input type="hidden" name="mailboxId" value={mailboxId} />
      <FormFeedback state={state} namespace="mailboxes" paramKey="address" />

      <div className="space-y-1.5">
        <Label htmlFor={`displayName-${mailboxId}`}>{t("displayName")}</Label>
        <Input
          id={`displayName-${mailboxId}`}
          name="displayName"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("displayNamePlaceholder")}
          className="h-9 text-sm"
        />
      </div>

      <div className="space-y-1.5">
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
          className="h-9 text-sm"
        />
        <p className="text-xs text-zinc-500">{t("newPasswordHint")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SaveButton />
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X className="size-4" />
          {t("cancel")}
        </Button>
      </div>
      <p className="text-xs text-zinc-500">{t("editHint", { address })}</p>
    </form>
  );
}

export function EditMailboxDisplayName({
  mailboxId,
  address,
  displayName,
}: {
  mailboxId: string;
  address: string;
  displayName: string | null;
}) {
  const t = useTranslations("mailboxes");
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-700">{displayName || "—"}</span>
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
    <EditMailboxFields
      mailboxId={mailboxId}
      address={address}
      displayName={displayName}
      onCancel={() => setEditing(false)}
    />
  );
}

export function EditMailboxForm({
  mailboxId,
  address,
  displayName,
}: {
  mailboxId: string;
  address: string;
  displayName: string | null;
}) {
  const t = useTranslations("mailboxes");
  const [editing, setEditing] = useState(false);

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
    <EditMailboxFields
      mailboxId={mailboxId}
      address={address}
      displayName={displayName}
      onCancel={() => setEditing(false)}
    />
  );
}
