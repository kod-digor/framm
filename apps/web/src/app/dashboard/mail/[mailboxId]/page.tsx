import Link from "next/link";
import { notFound } from "next/navigation";
import { WebmailFrame } from "@/components/mail/webmail-frame";
import { StalwartStatusBanner } from "@/components/stalwart/status-banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getOrgId, requireOrgAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { getWebmailEmbedUrl, getWebmailExternalUrl } from "@/lib/stalwart/client";
import { getT } from "@/i18n/t";

export default async function MailPage({
  params,
}: {
  params: Promise<{ mailboxId: string }>;
}) {
  const { mailboxId } = await params;
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session)!;
  const t = await getT("mail");

  const mailbox = await prisma.mailbox.findFirst({
    where: { id: mailboxId, organizationId: orgId },
  });
  if (!mailbox) notFound();

  const embedUrl = getWebmailEmbedUrl(mailbox.address);
  const externalUrl = getWebmailExternalUrl();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 pt-3 sm:gap-4 sm:px-4 sm:pb-4 sm:pt-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-zinc-900 sm:text-xl">
            {mailbox.address}
          </h1>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href={`/dashboard/mailboxes/${mailbox.id}`}>{t("settings")}</Link>
        </Button>
      </div>

      <StalwartStatusBanner namespace="mailboxes" />

      {!embedUrl ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("unconfigured")}
        </p>
      ) : (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden py-0">
          <WebmailFrame
            src={embedUrl}
            externalUrl={externalUrl}
            address={mailbox.address}
          />
        </Card>
      )}
    </div>
  );
}
