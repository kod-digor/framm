"use client";

import { useActionState, useEffect, useState, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import {
  ArrowLeft,
  ArrowRightLeft,
  Cloud,
  Loader2,
  Mail,
  Server,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  confirmMigrationAction,
  discoverMigrationSourceAction,
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
import type { MigrationSourceStats } from "@/lib/migration/discovery/types";
import { statsNeedReauth } from "@/lib/migration/discovery/api-error";
import {
  providerSupportsCalendar,
  providerSupportsContacts,
} from "@/lib/migration/discovery/provider-support";
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

function formatFrNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function formatFrDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function formatCalendarRangeStart(
  calendar: NonNullable<MigrationSourceStats["calendar"]>
): string {
  const iso =
    calendar.activityFirstEventDate ??
    calendar.firstEventDate;
  return iso ? formatFrDate(iso) : "—";
}

function formatCalendarRangeEnd(
  calendar: NonNullable<MigrationSourceStats["calendar"]>
): string {
  const iso =
    calendar.activityLastEventDate ??
    calendar.lastEventDate;
  return iso ? formatFrDate(iso) : "—";
}

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
  const [provider, setProvider] = useState<MigrationProvider | null>(
    activeStatus?.provider ?? null
  );
  const [sourceAddress, setSourceAddress] = useState(
    activeStatus?.sourceAddress ?? ""
  );
  const [scopeMail, setScopeMail] = useState(true);
  const [scopeContacts, setScopeContacts] = useState(true);
  const [scopeCalendar, setScopeCalendar] = useState(true);
  const [sourceStats, setSourceStats] = useState<MigrationSourceStats | null>(
    activeStatus?.sourceStats ?? null
  );

  const effectiveProvider = provider ?? activeStatus?.provider ?? null;
  const contactsSupported = effectiveProvider
    ? providerSupportsContacts(effectiveProvider)
    : true;
  const calendarSupported = effectiveProvider
    ? providerSupportsCalendar(effectiveProvider)
    : true;
  const showReauth =
    !!sourceStats &&
    !!migrationId &&
    (effectiveProvider === "GOOGLE" || effectiveProvider === "MICROSOFT") &&
    statsNeedReauth(sourceStats);

  const reauthHref =
    effectiveProvider === "GOOGLE"
      ? `/api/migration/oauth/google?migrationId=${encodeURIComponent(migrationId ?? "")}`
      : effectiveProvider === "MICROSOFT"
        ? `/api/migration/oauth/microsoft?migrationId=${encodeURIComponent(migrationId ?? "")}`
        : null;

  const needsDiscovery =
    step === "scope" &&
    !!migrationId &&
    (!sourceStats?.discoveredAt ||
      statsNeedReauth(sourceStats) ||
      (!sourceStats.mail.available &&
        !sourceStats.contacts.available &&
        !sourceStats.calendar.available));

  useEffect(() => {
    if (!needsDiscovery || !migrationId) return;

    let cancelled = false;
    void discoverMigrationSourceAction(migrationId).then((stats) => {
      if (!cancelled && stats) setSourceStats(stats);
    });

    return () => {
      cancelled = true;
    };
  }, [needsDiscovery, migrationId]);

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

            {needsDiscovery ? (
              <div className="flex items-center gap-2 rounded-md border border-canal bg-neutral-50 px-4 py-3 text-sm text-ardoise/70">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {t("migration.statsDiscovering")}
              </div>
            ) : sourceStats ? (
              <SourceStatsPanel
                stats={sourceStats}
                provider={effectiveProvider}
                t={t}
              />
            ) : null}

            {showReauth && reauthHref ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p>{t("migration.statsReauthHint")}</p>
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <a href={reauthHref}>{t("migration.reconnectOAuth")}</a>
                </Button>
              </div>
            ) : null}

            <ScopeRow
              id="scope-mail"
              name="scopeMail"
              label={t("migration.scopeMail")}
              checked={scopeMail}
              onChange={setScopeMail}
            />
            <ScopeRow
              id="scope-contacts"
              name="scopeContacts"
              label={t("migration.scopeContacts")}
              checked={scopeContacts}
              onChange={setScopeContacts}
              disabled={!contactsSupported}
            />
            <ScopeRow
              id="scope-calendar"
              name="scopeCalendar"
              label={t("migration.scopeCalendar")}
              checked={scopeCalendar}
              onChange={setScopeCalendar}
              disabled={!calendarSupported}
            />
          </div>

          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep("provider")}>
              <ArrowLeft className="mr-1 size-4" aria-hidden />
              {t("migration.back")}
            </Button>
            <Button
              type="button"
              onClick={() => setStep("confirm")}
              disabled={!scopeMail && !scopeContacts && !scopeCalendar}
            >
              {t("migration.continue")}
            </Button>
          </div>
        </div>
      ) : null}

      {!showStatus && step === "confirm" ? (
        <form action={confirmAction} className="space-y-6">
          <input type="hidden" name="migrationId" value={migrationId ?? ""} />
          {scopeMail ? <input type="hidden" name="scopeMail" value="true" /> : null}
          {scopeContacts ? <input type="hidden" name="scopeContacts" value="on" /> : null}
          {scopeCalendar ? <input type="hidden" name="scopeCalendar" value="on" /> : null}

          {sourceStats ? (
            <SourceStatsPanel
              stats={sourceStats}
              provider={effectiveProvider}
              t={t}
            />
          ) : null}

          <p className="text-sm text-ardoise/70">{t("migration.confirmBackgroundHint")}</p>

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

const STATS_ERROR_KEYS = [
  "token_expired",
  "insufficient_scope",
  "oauth_refresh_failed",
  "oauth_token_missing",
  "source_credentials_missing",
  "gmail_api_error",
  "people_api_error",
  "calendar_api_error",
  "calendar_api_disabled",
  "graph_mail_error",
  "graph_contacts_error",
  "graph_calendar_error",
  "imap_error",
  "carddav_error",
  "caldav_error",
  "imap_no_contacts",
  "imap_no_calendar",
  "unsupported",
] as const;

type StatsErrorKey = (typeof STATS_ERROR_KEYS)[number];

function isStatsErrorKey(value: string): value is StatsErrorKey {
  return (STATS_ERROR_KEYS as readonly string[]).includes(value);
}

function formatStatsError(
  t: ReturnType<typeof useTranslations<"users">>,
  reason?: string
): string {
  if (reason && isStatsErrorKey(reason)) {
    return t(`migration.statsError_${reason}`);
  }
  return t("migration.statsError_generic");
}

function SourceStatsPanel({
  stats,
  provider,
  t,
}: {
  stats: MigrationSourceStats;
  provider: MigrationProvider | null;
  t: ReturnType<typeof useTranslations<"users">>;
}) {
  const showContacts = provider ? providerSupportsContacts(provider) : true;
  const showCalendar = provider ? providerSupportsCalendar(provider) : true;

  return (
    <div className="space-y-2 rounded-md border border-canal bg-neutral-50/80 px-4 py-3 text-sm">
      {stats.mail.available ? (
        <>
          <p className="text-encre">
            {t("migration.statsMail", {
              count: formatFrNumber(stats.mail.messageCount ?? 0),
              folders: formatFrNumber(stats.mail.folderCount ?? 0),
            })}
          </p>
          {typeof stats.mail.attachmentCount === "number" ? (
            <p className="text-encre">
              {t("migration.stats.attachments", {
                count: formatFrNumber(stats.mail.attachmentCount),
              })}
              {stats.mail.attachmentCountIsEstimate ? (
                <span className="text-ardoise/60">
                  {" "}
                  {t("migration.statsAttachmentsEstimate")}
                </span>
              ) : null}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-ardoise/70">
          {t("migration.statsMailError", {
            error: formatStatsError(t, stats.mail.unavailableReason),
          })}
        </p>
      )}
      {showContacts ? (
        stats.contacts.available ? (
          <p className="text-encre">
            {t("migration.statsContacts", {
              count: formatFrNumber(stats.contacts.contactCount ?? 0),
              groups: formatFrNumber(stats.contacts.groupCount ?? 0),
            })}
          </p>
        ) : (
          <p className="text-ardoise/70">
            {t("migration.statsContactsError", {
              error: formatStatsError(t, stats.contacts.unavailableReason),
            })}
          </p>
        )
      ) : null}
      {showCalendar ? (
        stats.calendar.available ? (
          stats.calendar.eventCount && stats.calendar.eventCount > 0 ? (
            <p className="text-encre">
              {stats.calendar.recurringCount && stats.calendar.recurringCount > 0
                ? t("migration.statsCalendarWithRecurring", {
                    count: formatFrNumber(stats.calendar.eventCount),
                    recurring: formatFrNumber(stats.calendar.recurringCount),
                    from: formatCalendarRangeStart(stats.calendar),
                    to: formatCalendarRangeEnd(stats.calendar),
                  })
                : t("migration.statsCalendar", {
                    count: formatFrNumber(stats.calendar.eventCount),
                    from: formatCalendarRangeStart(stats.calendar),
                    to: formatCalendarRangeEnd(stats.calendar),
                  })}
            </p>
          ) : (
            <p className="text-encre">{t("migration.statsCalendarEmpty")}</p>
          )
        ) : (
          <p className="text-ardoise/70">
            {t("migration.statsCalendarError", {
              error: formatStatsError(t, stats.calendar.unavailableReason),
            })}
          </p>
        )
      ) : null}
    </div>
  );
}

function ScopeRow({
  id,
  name,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
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
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 rounded border-canal"
        />
        <Label htmlFor={id} className={cn("font-normal", disabled && "text-ardoise/50")}>
          {label}
        </Label>
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
