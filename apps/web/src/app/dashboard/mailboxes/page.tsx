import { getOrgId, requireOrgAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { CreateMailboxForm } from "@/components/mailboxes/create-mailbox-form";
import { MailboxList } from "@/components/mailboxes/mailbox-list";
import { StalwartStatusBanner } from "@/components/stalwart/status-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isDnsVerifiedDomainStatus, MAIL_USABLE_DOMAIN_STATUSES } from "@/lib/domain-status";
import { getT } from "@/i18n/t";
import { Mailbox } from "lucide-react";

export default async function MailboxesPage() {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session)!;
  const t = await getT("mailboxes");

  const [mailboxes, domains] = await Promise.all([
    prisma.mailbox.findMany({
      where: { organizationId: orgId },
      include: { domain: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.domain.findMany({
      where: { organizationId: orgId, status: { in: MAIL_USABLE_DOMAIN_STATUSES } },
      orderBy: { fqdn: "asc" },
    }),
  ]);

  const mailboxRows = mailboxes.map((mailbox) => ({
    id: mailbox.id,
    address: mailbox.address,
    displayName: mailbox.displayName,
    domain: mailbox.domain.fqdn,
    usedBytes: Number(mailbox.usedBytes),
    quotaBytes: Number(mailbox.quotaBytes),
  }));

  const listLabels = {
    colAddress: t("colAddress"),
    colDisplayName: t("colDisplayName"),
    colDomain: t("colDomain"),
    colQuota: t("colQuota"),
    colActions: t("colActions"),
    config: t("config"),
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <StalwartStatusBanner namespace="mailboxes" />

      {domains.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("add")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateMailboxForm
              domains={domains.map((d) => ({
                id: d.id,
                fqdn: d.fqdn,
                isDnsVerified: isDnsVerifiedDomainStatus(d.status),
              }))}
            />
          </CardContent>
        </Card>
      ) : (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("noDomain")}
        </p>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("listTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {mailboxes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-6 py-10 text-center">
              <Mailbox className="mx-auto size-8 text-zinc-300" aria-hidden />
              <p className="mt-3 text-sm font-medium text-zinc-700">{t("emptyTitle")}</p>
              <p className="mt-1 text-sm text-zinc-500">{t("emptyHint")}</p>
            </div>
          ) : (
            <MailboxList mailboxes={mailboxRows} labels={listLabels} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
