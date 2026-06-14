"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { updateSharedMailboxAction } from "@/app/actions/shared-mailboxes";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  OrgMembersPicker,
  type OrgMemberOption,
} from "@/components/shared-mailboxes/org-members-picker";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  const t = useTranslations("sharedMailboxes");

  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? t("saving") : t("save")}
    </Button>
  );
}

export function EditSharedMailboxForm({
  sharedMailboxId,
  address,
  displayName,
  memberUserIds,
  orgMembers,
  onSuccess,
  onCancel,
}: {
  sharedMailboxId: string;
  address: string;
  displayName: string | null;
  memberUserIds: string[];
  orgMembers: OrgMemberOption[];
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("sharedMailboxes");
  const [state, action] = useActionState(updateSharedMailboxAction, INITIAL_ACTION_RESULT);
  const [memberIds, setMemberIds] = useState(memberUserIds);

  useEffect(() => {
    if (state?.ok && onSuccess) onSuccess();
  }, [state, onSuccess]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="sharedMailboxId" value={sharedMailboxId} />
      <FormFeedback state={state} namespace="sharedMailboxes" />

      <div className="space-y-2">
        <Label>{t("address")}</Label>
        <p className="font-mono-data text-sm text-encre">{address}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`edit-displayName-${sharedMailboxId}`}>{t("displayName")}</Label>
        <Input
          id={`edit-displayName-${sharedMailboxId}`}
          name="displayName"
          defaultValue={displayName ?? ""}
        />
      </div>

      <OrgMembersPicker
        members={orgMembers}
        selectedIds={memberIds}
        onChange={setMemberIds}
        idPrefix={`edit-${sharedMailboxId}`}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} className="cursor-pointer">
            {t("cancel")}
          </Button>
        ) : null}
        <SubmitButton disabled={memberIds.length === 0} />
      </div>
    </form>
  );
}
