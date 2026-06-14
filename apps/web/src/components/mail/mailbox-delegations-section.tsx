"use client";

import { useEffect } from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  addMailboxDelegationAction,
  removeMailboxDelegationAction,
} from "@/app/actions/mail-delegations";
import type { OrgMemberOption } from "@/components/shared-mailboxes/org-members-picker";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";
import type { MailboxDelegationPermission } from "@prisma/client";

export type DelegationRow = {
  id: string;
  delegateUserId: string;
  label: string;
  email: string;
  permission: MailboxDelegationPermission;
};

export function MailboxDelegationsSection({
  mailboxId,
  delegations,
  orgMembers,
  ownerUserId,
  onSuccess,
}: {
  mailboxId: string;
  delegations: DelegationRow[];
  orgMembers: OrgMemberOption[];
  ownerUserId: string;
  onSuccess?: () => void;
}) {
  const t = useTranslations("mailDelegation");
  const [state, formAction] = useActionState(addMailboxDelegationAction, INITIAL_ACTION_RESULT);

  useEffect(() => {
    if (state?.ok) onSuccess?.();
  }, [state, onSuccess]);

  const candidates = orgMembers.filter((m) => m.userId !== ownerUserId);

  return (
    <div className="space-y-4">
      {delegations.length > 0 ? (
        <ul className="space-y-2">
          {delegations.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-canal bg-white px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-encre">{row.label}</p>
                <p className="font-mono-data text-xs text-ardoise/60">{row.email}</p>
                <p className="text-xs text-ardoise/50">
                  {row.permission === "READ" ? t("permissionRead") : t("permissionSend")}
                </p>
              </div>
              <form action={removeMailboxDelegationAction}>
                <input type="hidden" name="delegationId" value={row.id} />
                <ConfirmSubmitButton
                  namespace="mailDelegation"
                  messageKey="confirmRemove"
                  className="h-8 px-2 text-red-600"
                >
                  {t("remove")}
                </ConfirmSubmitButton>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ardoise/50">{t("empty")}</p>
      )}

      {candidates.length > 0 ? (
        <form action={formAction} className="space-y-3 rounded-md border border-canal bg-white p-3">
          <input type="hidden" name="mailboxId" value={mailboxId} />
          <div className="space-y-1.5">
            <Label htmlFor={`delegate-${mailboxId}`}>{t("addDelegate")}</Label>
            <select
              id={`delegate-${mailboxId}`}
              name="delegateUserId"
              required
              className="h-9 w-full rounded-md border border-canal bg-white px-3 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                {t("selectMember")}
              </option>
              {candidates.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.label} ({member.email})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`permission-${mailboxId}`}>{t("permission")}</Label>
            <select
              id={`permission-${mailboxId}`}
              name="permission"
              className="h-9 w-full rounded-md border border-canal bg-white px-3 text-sm"
              defaultValue="SEND"
            >
              <option value="SEND">{t("permissionSend")}</option>
              <option value="READ">{t("permissionRead")}</option>
            </select>
          </div>
          <Button type="submit" size="sm">
            {t("add")}
          </Button>
          <FormFeedback state={state} namespace="mailDelegation" />
        </form>
      ) : null}
    </div>
  );
}
