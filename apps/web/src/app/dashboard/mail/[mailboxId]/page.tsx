import Link from "next/link";
import { notFound } from "next/navigation";
import { BulwarkMail } from "@/components/mail/bulwark-mail";
import { WebmailFrame } from "@/components/mail/webmail-frame";
import { StalwartStatusBanner } from "@/components/stalwart/status-banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth-utils";
import { resolveAuthorizedMailbox } from "@/lib/mail/mailbox-access";
import { getWebmailExternalUrl } from "@/lib/stalwart/client";
import { getT } from "@/i18n/t";

export default async function MailPage({
  params,
}: {
  params: Promise<{ mailboxId: string }>;
}) {
  const { mailboxId } = await params;
  await requireAuth();
  const t = await getT("mail");

  const access = await resolveAuthorizedMailbox(mailboxId);
  if ("error" in access) {
    if (access.error === "not_found" || access.error === "forbidden") notFound();
    throw new Error(access.error);
  }
  const mailbox = access.mailbox;
  const settingsHref = mailbox.isShared
    ? "/dashboard/shared-mailboxes"
    : `/dashboard/mailboxes/${mailbox.id}`;

  const webmailConfigured = Boolean(getWebmailExternalUrl());
  const externalUrl = getWebmailExternalUrl();
  const useNativeJmap = process.env.WEBMAIL_USE_NATIVE_JMAP === "true";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 sm:gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-zinc-900 sm:text-xl">
            {mailbox.address}
          </h1>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href={`/dashboard/mail/${mailboxId}/filters`}>{t("filters")}</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href={settingsHref}>{t("settings")}</Link>
          </Button>
        </div>
      </div>

      <StalwartStatusBanner namespace="mailboxes" />

      {!webmailConfigured ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("unconfigured")}
        </p>
      ) : !mailbox.credentialsEnc ? (
        <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p>{t("noCredentials")}</p>
          <Button asChild variant="outline" size="sm" className="border-amber-300 bg-white hover:bg-amber-50">
            <Link href="/dashboard/mailboxes">{t("noCredentialsAction")}</Link>
          </Button>
        </div>
      ) : (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden py-0">
          {useNativeJmap ? (
            <BulwarkMail
              mailboxId={mailboxId}
              address={mailbox.address}
              externalUrl={externalUrl}
            />
          ) : (
            <WebmailFrame
              mailboxId={mailboxId}
              address={mailbox.address}
              externalUrl={externalUrl}
            />
          )}
        </Card>
      )}
    </div>
  );
}
