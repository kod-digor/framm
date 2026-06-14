"use client";

import { useActionState, useState, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import {
  ArrowLeft,
  ArrowRightLeft,
  Cloud,
  Mail,
  Server,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  confirmMigrationAction,
  saveImapCredentialsAction,
  startMigrationAction,
} from "@/app/actions/mailbox-migration";
import { MigrationStatusPanel } from "@/components/users/migration-status-panel";
import { FormFeedback } from "@/components/ui/form-feedback";
import { FormDrawer } from "@/components/ui/form-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";
import { ICLOUD_IMAP_PRESET } from "@/lib/migration/providers/imap-generic";
import type { MigrationProvider } from "@prisma/client";
import type { MigrationStatusPayload } from "@/lib/migration/types";
import { cn } from "@/lib/utils";

type ProviderOption = {
  id: MigrationProvider;
  icon: typeof Mail;
  oauth?: boolean;
};

const PROVIDERS: ProviderOption[] = [
  { id: "GOOGLE", icon: Mail, oauth: true },
  { id: "MICROSOFT", icon: Cloud, oauth: true },
  { id: "ICLOUD", icon: Cloud },
  { id: "IMAP_GENERIC", icon: Server },
];

const PROVIDER_LABELS: Record<
  MigrationProvider,
  | "migration.providerGoogle"
  | "migration.providerMicrosoft"
  | "migration.providerIcloud"
  | "migration.providerImap"
> = {
  GOOGLE: "migration.providerGoogle",
  MICROSOFT: "migration.providerMicrosoft",
  ICLOUD: "migration.providerIcloud",
  IMAP_GENERIC: "migration.providerImap",
};

type WizardStep = "provider" | "credentials" | "scope" | "confirm" | "status";

function StepActions({
  label,
  pendingLabel,
  disabled,
}: {
  label: string;
  pendingLabel: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} aria-busy={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

type MigrationWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mailboxId: string;
  targetAddress: string;
  userEmail: string;
  initialMigrationId?: string | null;
  initialStep?: WizardStep | null;
  activeStatus?: MigrationStatusPayload | null;
  onStatusChange?: () => void;
};

export function MigrationWizard(props: MigrationWizardProps) {
  if (!props.open) return null;
  return <MigrationWizardBody {...props} />;
}

function MigrationWizardBody({
  onOpenChange,
  mailboxId,
  targetAddress,
  userEmail,
  initialMigrationId,
  initialStep,
  activeStatus,
  onStatusChange,
}: MigrationWizardProps) {
  const t = useTranslations("users");
  const [step, setStep] = useState<WizardStep>(initialStep ?? "provider");
  const [migrationId, setMigrationId] = useState<string | null>(initialMigrationId ?? null);
  const [provider, setProvider] = useState<MigrationProvider | null>(null);
  const [sourceAddress, setSourceAddress] = useState(
    activeStatus?.sourceAddress ?? ""
  );

  const [startState, startAction] = useActionState(
    async (prev: ActionResult, formData: FormData) => {
      const providerValue = (formData.get("provider") as string)?.trim() as MigrationProvider;
      const result = await startMigrationAction(prev, formData);

      if (result?.ok && result.detail) {
        if (providerValue === "GOOGLE") {
          window.location.href = `/api/migration/oauth/google?migrationId=${encodeURIComponent(result.detail)}`;
          return result;
        }
        if (providerValue === "MICROSOFT") {
          window.location.href = `/api/migration/oauth/microsoft?migrationId=${encodeURIComponent(result.detail)}`;
          return result;
        }
        setMigrationId(result.detail);
        setStep("credentials");
      }

      return result;
    },
    INITIAL_ACTION_RESULT
  );

  const [imapState, imapAction] = useActionState(
    async (prev: ActionResult, formData: FormData) => {
      const result = await saveImapCredentialsAction(prev, formData);
      if (result?.ok) setStep("scope");
      return result;
    },
    INITIAL_ACTION_RESULT
  );

  const [confirmState, confirmAction] = useActionState(
    async (prev: ActionResult, formData: FormData) => {
      const result = await confirmMigrationAction(prev, formData);
      if (result?.ok) {
        setStep("status");
        onStatusChange?.();
      }
      return result;
    },
    INITIAL_ACTION_RESULT
  );

  const showStatus =
    step === "status" ||
    (activeStatus &&
      (activeStatus.status === "QUEUED" ||
        activeStatus.status === "RUNNING" ||
        activeStatus.status === "COMPLETED" ||
        activeStatus.status === "FAILED"));

  const title = showStatus ? t("migration.statusTitle") : t("migration.wizardTitle");

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) onOpenChange(false);
  };

  return (
    <FormDrawer
      open
      onOpenChange={handleOpenChange}
      title={title}
      description={t("migration.wizardHint", { email: userEmail })}
    >
      {showStatus && (migrationId || activeStatus) ? (
        <MigrationStatusPanel
          mailboxId={mailboxId}
          migrationId={migrationId ?? activeStatus?.id ?? ""}
          initialStatus={activeStatus}
          onCancelled={() => onStatusChange?.()}
        />
      ) : null}

      {!showStatus && step === "provider" ? (
        <div className="space-y-4">
          <p className="text-sm text-ardoise/70">{t("migration.providerIntro")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {PROVIDERS.map((item) => {
              const Icon = item.icon;
              const selected = provider === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setProvider(item.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-4 text-left transition-colors",
                    selected
                      ? "border-encre bg-encre/5 ring-1 ring-encre"
                      : "border-canal bg-white hover:border-ardoise/30"
                  )}
                >
                  <div className="flex size-10 items-center justify-center rounded-md border border-canal bg-neutral-50">
                    <Icon className="size-5 text-ardoise/70" aria-hidden />
                  </div>
                  <div>
                    <p className="font-medium text-encre">{t(PROVIDER_LABELS[item.id])}</p>
                    {item.oauth ? (
                      <p className="text-xs text-ardoise/60">{t("migration.oauthBadge")}</p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          <form action={startAction} className="flex justify-end gap-2 pt-2">
            <input type="hidden" name="mailboxId" value={mailboxId} />
            <input type="hidden" name="provider" value={provider ?? ""} />
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("migration.cancel")}
            </Button>
            <StepActions
              label={t("migration.continue")}
              pendingLabel={t("migration.starting")}
              disabled={!provider}
            />
          </form>
          <FormFeedback state={startState} namespace="users" paramKey="detail" />
        </div>
      ) : null}

      {!showStatus &&
      step === "credentials" &&
      (provider === "ICLOUD" || provider === "IMAP_GENERIC") ? (
        <ImapCredentialsForm
          migrationId={migrationId}
          provider={provider!}
          action={imapAction}
          state={imapState}
          defaultHost={provider === "ICLOUD" ? ICLOUD_IMAP_PRESET.host : ""}
          defaultPort={provider === "ICLOUD" ? ICLOUD_IMAP_PRESET.port : 993}
          onBack={() => setStep("provider")}
          onCancel={() => onOpenChange(false)}
        />
      ) : null}

      {!showStatus && step === "scope" ? (
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-encre">{t("migration.scopeTitle")}</h3>
            <p className="text-sm text-ardoise/70">{t("migration.scopeIntro")}</p>
            <ScopeRow
              id="scope-mail"
              name="scopeMail"
              label={t("migration.scopeMail")}
              checked
              disabled
            />
            <ScopeRow
              id="scope-contacts"
              name="scopeContacts"
              label={t("migration.scopeContacts")}
              badge={t("migration.comingSoon")}
              checked={false}
              disabled
            />
            <ScopeRow
              id="scope-calendar"
              name="scopeCalendar"
              label={t("migration.scopeCalendar")}
              badge={t("migration.comingSoon")}
              checked={false}
              disabled
            />
          </div>

          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep("provider")}>
              <ArrowLeft className="mr-1 size-4" aria-hidden />
              {t("migration.back")}
            </Button>
            <Button type="button" onClick={() => setStep("confirm")}>
              {t("migration.continue")}
            </Button>
          </div>
        </div>
      ) : null}

      {!showStatus && step === "confirm" ? (
        <form action={confirmAction} className="space-y-6">
          <input type="hidden" name="migrationId" value={migrationId ?? ""} />
          <input type="hidden" name="scopeMail" value="true" />

          <div className="rounded-lg border border-canal bg-neutral-50/50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-encre">
              <ArrowRightLeft className="size-4" aria-hidden />
              {t("migration.confirmTitle")}
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-ardoise/60">{t("migration.sourceLabel")}</dt>
                <dd className="font-mono-data text-encre">
                  <Input
                    name="sourceAddress"
                    value={sourceAddress}
                    onChange={(e) => setSourceAddress(e.target.value)}
                    placeholder={t("migration.sourcePlaceholder")}
                    className="mt-1"
                  />
                </dd>
              </div>
              <div>
                <dt className="text-ardoise/60">{t("migration.targetLabel")}</dt>
                <dd className="font-mono-data text-encre">{targetAddress}</dd>
              </div>
            </dl>
          </div>

          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep("scope")}>
              <ArrowLeft className="mr-1 size-4" aria-hidden />
              {t("migration.back")}
            </Button>
            <StepActions label={t("migration.startMigration")} pendingLabel={t("migration.queuing")} />
          </div>
          <FormFeedback state={confirmState} namespace="users" paramKey="detail" />
        </form>
      ) : null}
    </FormDrawer>
  );
}

function ScopeRow({
  id,
  name,
  label,
  badge,
  checked,
  disabled,
}: {
  id: string;
  name: string;
  label: string;
  badge?: string;
  checked: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-canal bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={id}
          name={name}
          checked={checked}
          disabled={disabled}
          readOnly={disabled}
          className="size-4 rounded border-canal"
        />
        <Label htmlFor={id} className="font-normal">{label}</Label>
        {badge ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
            {badge}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ImapCredentialsForm({
  migrationId,
  provider,
  action,
  state,
  defaultHost,
  defaultPort,
  onBack,
  onCancel,
}: {
  migrationId: string | null;
  provider: MigrationProvider;
  action: NonNullable<ComponentProps<"form">["action"]>;
  state: ActionResult;
  defaultHost: string;
  defaultPort: number;
  onBack: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("users");
  const isIcloud = provider === "ICLOUD";

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="migrationId" value={migrationId ?? ""} />

      {isIcloud ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("migration.icloudHint")}
        </p>
      ) : (
        <p className="text-sm text-ardoise/70">{t("migration.imapIntro")}</p>
      )}

      {!isIcloud ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="imap-host">{t("migration.imapHost")}</Label>
            <Input id="imap-host" name="host" required placeholder="imap.example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="imap-port">{t("migration.imapPort")}</Label>
            <Input
              id="imap-port"
              name="port"
              type="number"
              required
              defaultValue={defaultPort}
            />
          </div>
        </div>
      ) : (
        <>
          <input type="hidden" name="host" value={defaultHost} />
          <input type="hidden" name="port" value={defaultPort} />
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="imap-user">{t("migration.imapUser")}</Label>
        <Input
          id="imap-user"
          name="user"
          type="email"
          required
          placeholder={isIcloud ? "nom@icloud.com" : "nom@example.com"}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="imap-password">{t("migration.imapPassword")}</Label>
        <Input id="imap-password" name="password" type="password" required />
        <p className="text-xs text-ardoise/60">
          {isIcloud ? t("migration.icloudPasswordHint") : t("migration.imapPasswordHint")}
        </p>
      </div>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-1 size-4" aria-hidden />
          {t("migration.back")}
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("migration.cancel")}
          </Button>
          <StepActions label={t("migration.continue")} pendingLabel={t("migration.saving")} />
        </div>
      </div>
      <FormFeedback state={state} namespace="users" paramKey="detail" />
    </form>
  );
}
