import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrgId, requireOrgAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { getMailConfig } from "@/lib/stalwart/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getT } from "@/i18n/t";

export default async function MailboxConfigPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session)!;
  const t = await getT("mailboxes");

  const mailbox = await prisma.mailbox.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!mailbox) notFound();

  const config = getMailConfig();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{mailbox.address}</h1>
        <Button asChild variant="outline">
          <Link href="/dashboard/mailboxes">←</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("config")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <span className="font-medium">{t("imapServer")} :</span> {config.imapServer}
          </div>
          <div>
            <span className="font-medium">{t("smtpServer")} :</span> {config.smtpServer}
          </div>
          <div>
            <span className="font-medium">{t("imapPort")} :</span> {config.imapPort}
          </div>
          <div>
            <span className="font-medium">{t("smtpPort")} :</span> {config.smtpPort}
          </div>
          <div>
            <span className="font-medium">{t("username")} :</span> {mailbox.address}
          </div>
          {config.webmailUrl && (
            <div className="pt-2">
              <Button asChild>
                <a href={config.webmailUrl} target="_blank" rel="noopener noreferrer">
                  {t("webmail")}
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
