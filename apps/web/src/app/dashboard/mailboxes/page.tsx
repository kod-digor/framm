import { getOrgId, requireOrgAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { MailboxesCrud } from "@/components/mailboxes/mailboxes-crud";
import { StalwartStatusBanner } from "@/components/stalwart/status-banner";
import { isDnsVerifiedDomainStatus, MAIL_USABLE_DOMAIN_STATUSES } from "@/lib/domain-status";
import { getT } from "@/i18n/t";

export default async function MailboxesPage() {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session)!;
  const t = await getT("mailboxes");

  const [mailboxes, domains] = await Promise.all([
    prisma.mailbox.findMany({
      where: { organizationId: orgId, isShared: false },
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
    quotaBytes: mailbox.quotaBytes != null ? Number(mailbox.quotaBytes) : null,
  }));

  const listLabels = {
    colAddress: t("colAddress"),
    colDisplayName: t("colDisplayName"),
    colDomain: t("colDomain"),
    colQuota: t("colQuota"),
    colActions: t("colActions"),
    config: t("config"),
    quotaUnlimited: t("quotaUnlimited"),
  };

  return (
    <div className="space-y-6">
      <StalwartStatusBanner namespace="mailboxes" />
      <MailboxesCrud
        mailboxes={mailboxRows}
        domains={domains.map((d) => ({
          id: d.id,
          fqdn: d.fqdn,
          isDnsVerified: isDnsVerifiedDomainStatus(d.status),
        }))}
        listLabels={listLabels}
      />
    </div>
  );
}
