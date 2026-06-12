import { getOrgId, requireOrgAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/t";

export default async function DashboardPage() {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session);
  const t = await getT("dashboard");

  const stats = orgId
    ? {
        domains: await prisma.domain.count({ where: { organizationId: orgId } }),
        mailboxes: await prisma.mailbox.count({ where: { organizationId: orgId } }),
        aliases: await prisma.emailAlias.count({ where: { organizationId: orgId } }),
      }
    : null;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">{t("welcome")}</h1>
      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>{t("domains")}</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{stats.domains}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("mailboxes")}</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{stats.mailboxes}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("aliases")}</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{stats.aliases}</CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
