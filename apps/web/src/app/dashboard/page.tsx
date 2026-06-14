import { getOrgId, requireOrgAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { ServiceStatusPanel } from "@/components/layout/brand-panels";
import { getT } from "@/i18n/t";

export default async function DashboardPage() {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session);
  const t = await getT("dashboard");

  const stats = orgId
    ? {
        domains: await prisma.domain.count({
          where: {
            organizationId: orgId,
            status: { in: ["VERIFIED", "ACTIVE"] },
          },
        }),
        mailboxes: await prisma.mailbox.count({ where: { organizationId: orgId } }),
        dnsPending: await prisma.domain.count({
          where: { organizationId: orgId, status: "PENDING_DNS" },
        }),
      }
    : null;

  return (
    <div>
      <PageHeader title={t("welcome")} description={t("welcomeHint")} />
      {stats ? (
        <ServiceStatusPanel
          title={t("serviceStatus")}
          items={[
            {
              id: "domains",
              label: t("domainsActive"),
              value: String(stats.domains),
              href: "/dashboard/domains",
              tone: stats.dnsPending > 0 ? "attention" : "ok",
            },
            {
              id: "mailboxes",
              label: t("mailboxes"),
              value: String(stats.mailboxes),
              href: "/dashboard/mailboxes",
              tone: "neutral",
            },
            {
              id: "dns",
              label: t("dnsPending"),
              value: stats.dnsPending > 0 ? String(stats.dnsPending) : "—",
              href: stats.dnsPending > 0 ? "/dashboard/domains" : undefined,
              tone: stats.dnsPending > 0 ? "attention" : "ok",
            },
          ]}
        />
      ) : null}
    </div>
  );
}
