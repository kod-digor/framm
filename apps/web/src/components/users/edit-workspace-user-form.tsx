"use client";

import { useCallback, useEffect } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { AtSign, Loader2, Mail, User, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  removeMailboxAddressAction,
  updateWorkspaceUserAction,
} from "@/app/actions/workspace-users";
import { AddMailboxAddressForm } from "@/components/users/add-mailbox-address-form";
import { AssociateMailboxForm } from "@/components/users/associate-mailbox-form";
import {
  MailboxDelegationsSection,
  type DelegationRow,
} from "@/components/mail/mailbox-delegations-section";
import type { OrgMemberOption } from "@/components/shared-mailboxes/org-members-picker";
import { FormFeedback } from "@/components/ui/form-feedback";
import { FormDrawer } from "@/components/ui/form-drawer";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { CRUD_ACTIONS_CELL_CLASS, CRUD_ACTIONS_HEADER_CLASS } from "@/components/ui/crud-row-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";
import type { MailboxAddressPatternType } from "@prisma/client";
import { cn } from "@/lib/utils";

type DomainSimple = { id: string; fqdn: string };

export type EditUserDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  userEmail: string;
  displayName: string | null;
  primaryAddress: string | null;
  mailboxId: string | null;
  alternateAddresses: {
    id: string;
    address: string;
    patternType: MailboxAddressPatternType;
  }[];
  mustChangePassword: boolean;
  domains: DomainSimple[];
  userId: string;
  delegationsGranted: DelegationRow[];
  orgMembers: OrgMemberOption[];
};

function DrawerSection({
  id,
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "rounded-lg border border-canal bg-neutral-50/50 p-4",
        className
      )}
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-canal bg-white">
          <Icon className="size-4 text-ardoise/70" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 id={id} className="text-sm font-semibold text-encre">
            {title}
          </h3>
          {description ? (
            <p className="mt-0.5 text-xs text-ardoise/60">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function ProfileSaveButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("users");

  return (
    <Button type="submit" size="sm" disabled={pending} aria-busy={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? t("saving") : t("editDrawer.saveProfile")}
    </Button>
  );
}

function ProfileSection({
  memberId,
  displayName,
  mustChangePassword,
  onRefresh,
}: {
  memberId: string;
  displayName: string | null;
  mustChangePassword: boolean;
  onRefresh: () => void;
}) {
  const t = useTranslations("users");
  const [state, formAction] = useActionState(updateWorkspaceUserAction, INITIAL_ACTION_RESULT);

  useEffect(() => {
    if (!state?.ok) return;
    onRefresh();
  }, [state, onRefresh]);

  return (
    <DrawerSection
      id={`profile-heading-${memberId}`}
      icon={User}
      title={t("editDrawer.profileTitle")}
      description={t("editDrawer.profileDescription")}
    >
      <form
        key={`${memberId}-${displayName ?? ""}-${state?.ok ? "saved" : "idle"}`}
        action={formAction}
        className="space-y-4"
      >
        <input type="hidden" name="memberId" value={memberId} />
        <FormFeedback state={state} namespace="users" paramKey="detail" />

        <div className="space-y-2">
          <Label htmlFor={`displayName-${memberId}`}>{t("displayName")}</Label>
          <Input
            id={`displayName-${memberId}`}
            name="displayName"
            defaultValue={displayName ?? ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`password-${memberId}`}>{t("newPassword")}</Label>
          <Input
            id={`password-${memberId}`}
            name="password"
            type="password"
            minLength={8}
            autoComplete="new-password"
            placeholder="••••••••"
          />
          <p className="text-xs text-ardoise/50">{t("newPasswordHint")}</p>
        </div>

        {mustChangePassword ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              {t("editDrawer.mustChangePasswordBadge")}
            </span>
            <p className="text-xs text-ardoise/60">{t("editDrawer.mustChangePasswordInfo")}</p>
          </div>
        ) : null}

        <div className="flex justify-end border-t border-canal/60 pt-4">
          <ProfileSaveButton />
        </div>
      </form>
    </DrawerSection>
  );
}

function PrimaryMailboxSection({
  memberId,
  userEmail,
  primaryAddress,
  onRefresh,
}: {
  memberId: string;
  userEmail: string;
  primaryAddress: string | null;
  onRefresh: () => void;
}) {
  const t = useTranslations("users");

  return (
    <DrawerSection
      id={`mailbox-heading-${memberId}`}
      icon={Mail}
      title={t("editDrawer.mailboxTitle")}
      description={
        primaryAddress ? t("editDrawer.mailboxPresent") : t("editDrawer.mailboxAbsent")
      }
    >
      {primaryAddress ? (
        <p className="rounded-md border border-canal bg-white px-3 py-2 font-mono-data text-sm text-encre">
          {primaryAddress}
        </p>
      ) : (
        <AssociateMailboxForm
          memberId={memberId}
          userEmail={userEmail}
          onSuccess={onRefresh}
        />
      )}
    </DrawerSection>
  );
}

function MailboxAddressTypeBadge({
  patternType,
  labels,
}: {
  patternType: MailboxAddressPatternType;
  labels: { exact: string; pattern: string };
}) {
  const isExact = patternType === "EXACT";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        isExact
          ? "bg-neutral-100 text-ardoise/70 ring-canal"
          : "bg-sky-50 text-sky-800 ring-sky-200"
      )}
    >
      {isExact ? labels.exact : labels.pattern}
    </span>
  );
}

function AliasesSection({
  memberId,
  mailboxId,
  alternateAddresses,
  domains,
  onRefresh,
}: {
  memberId: string;
  mailboxId: string;
  alternateAddresses: EditUserDrawerProps["alternateAddresses"];
  domains: DomainSimple[];
  onRefresh: () => void;
}) {
  const t = useTranslations("users");

  if (domains.length === 0) return null;

  return (
    <DrawerSection
      id={`aliases-heading-${memberId}`}
      icon={AtSign}
      title={t("editDrawer.aliasesTitle")}
      description={t("secondaryAddresses")}
    >
      {alternateAddresses.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-canal bg-white">
          <table
            className="w-full min-w-[520px] text-left text-sm"
            aria-label={t("editDrawer.aliasesListLabel")}
          >
            <thead>
              <tr className="border-b border-canal bg-neutral-50/80 text-xs text-ardoise/60">
                <th className="px-3 py-2 font-medium">{t("colSecondaryAddresses")}</th>
                <th className="w-[100px] px-3 py-2 font-medium">{t("editDrawer.colType")}</th>
                <th className={`${CRUD_ACTIONS_HEADER_CLASS} px-3 py-2 text-right font-medium`}>{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {alternateAddresses.map((alt) => (
                <tr key={alt.id} className="border-b border-canal/60 last:border-0">
                  <td className="px-3 py-2.5">
                    <span className="font-mono-data text-ardoise/80">{alt.address}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <MailboxAddressTypeBadge
                      patternType={alt.patternType}
                      labels={{
                        exact: t("editDrawer.badgeExact"),
                        pattern: t("editDrawer.badgePattern"),
                      }}
                    />
                  </td>
                  <td className={`${CRUD_ACTIONS_CELL_CLASS} px-3 py-2.5 text-right`}>
                    <form action={removeMailboxAddressAction} className="inline-flex">
                      <input type="hidden" name="addressId" value={alt.id} />
                      <ConfirmSubmitButton
                        namespace="users"
                        messageKey="confirmRemoveAddress"
                        iconOnly
                        ariaLabel={t("removeAddressAria", { address: alt.address })}
                      />
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-canal bg-white/60 px-3 py-4 text-center text-sm text-ardoise/50">
          {t("editDrawer.aliasesEmpty")}
        </p>
      )}

      <div className="mt-4 rounded-md border border-canal bg-white p-3">
        <p className="mb-3 text-xs font-medium text-ardoise/70">
          {t("editDrawer.addAliasTitle")}
        </p>
        <AddMailboxAddressForm
          mailboxId={mailboxId}
          domains={domains}
          onSuccess={onRefresh}
        />
      </div>
    </DrawerSection>
  );
}

function DelegationsSection({
  mailboxId,
  userId,
  delegationsGranted,
  orgMembers,
  onRefresh,
}: {
  mailboxId: string;
  userId: string;
  delegationsGranted: DelegationRow[];
  orgMembers: OrgMemberOption[];
  onRefresh: () => void;
}) {
  const t = useTranslations("users");

  return (
    <DrawerSection
      id={`delegations-heading-${mailboxId}`}
      icon={Users}
      title={t("editDrawer.delegationsTitle")}
      description={t("editDrawer.delegationsHint")}
    >
      <MailboxDelegationsSection
        mailboxId={mailboxId}
        delegations={delegationsGranted}
        orgMembers={orgMembers}
        ownerUserId={userId}
        onSuccess={onRefresh}
      />
    </DrawerSection>
  );
}

function EditUserDrawerContent({
  memberId,
  userId,
  userEmail,
  displayName,
  primaryAddress,
  mailboxId,
  alternateAddresses,
  mustChangePassword,
  domains,
  delegationsGranted,
  orgMembers,
}: Omit<EditUserDrawerProps, "open" | "onOpenChange">) {
  const router = useRouter();
  const handleRefresh = useCallback(() => router.refresh(), [router]);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <ProfileSection
          memberId={memberId}
          displayName={displayName}
          mustChangePassword={mustChangePassword}
          onRefresh={handleRefresh}
        />

        <PrimaryMailboxSection
          memberId={memberId}
          userEmail={userEmail}
          primaryAddress={primaryAddress}
          onRefresh={handleRefresh}
        />
      </div>

      {mailboxId ? (
        <>
          <AliasesSection
            memberId={memberId}
            mailboxId={mailboxId}
            alternateAddresses={alternateAddresses}
            domains={domains}
            onRefresh={handleRefresh}
          />
          <DelegationsSection
            mailboxId={mailboxId}
            userId={userId}
            delegationsGranted={delegationsGranted}
            orgMembers={orgMembers}
            onRefresh={handleRefresh}
          />
        </>
      ) : null}
    </div>
  );
}

export function EditUserDrawer({
  open,
  onOpenChange,
  memberId,
  userId,
  userEmail,
  displayName,
  primaryAddress,
  mailboxId,
  alternateAddresses,
  mustChangePassword,
  domains,
  delegationsGranted,
  orgMembers,
}: EditUserDrawerProps) {
  const t = useTranslations("users");
  const drawerTitle = displayName?.trim() || userEmail;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={drawerTitle}
      description={t("editDrawer.loginEmail", { email: userEmail })}
      bodyClassName="py-6"
      footer={
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {t("editDrawer.close")}
        </Button>
      }
    >
      <EditUserDrawerContent
        memberId={memberId}
        userId={userId}
        userEmail={userEmail}
        displayName={displayName}
        primaryAddress={primaryAddress}
        mailboxId={mailboxId}
        alternateAddresses={alternateAddresses}
        mustChangePassword={mustChangePassword}
        domains={domains}
        delegationsGranted={delegationsGranted}
        orgMembers={orgMembers}
      />
    </FormDrawer>
  );
}

/** @deprecated Use EditUserDrawer */
export const EditUserDialog = EditUserDrawer;

/** @deprecated Use EditUserDrawer */
export const EditWorkspaceUserForm = EditUserDrawer;
