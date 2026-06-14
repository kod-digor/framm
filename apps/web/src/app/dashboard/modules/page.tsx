import { getOrgId, requireOrgAdmin } from "@/lib/auth-utils";
import { getOrganizationModules } from "@/lib/modules";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { ModulesPanel } from "@/components/modules/modules-panel";
import { getT } from "@/i18n/t";

export default async function ModulesPage() {
  const session = await requireOrgAdmin({ allowPendingBilling: true });
  const orgId = getOrgId(session)!;
  const t = await getT("modules");
  const modules = await getOrganizationModules(orgId);

  const [mailboxCount, sharedCount] = await Promise.all([
    prisma.mailbox.count({ where: { organizationId: orgId } }),
    prisma.sharedMailbox.count({ where: { organizationId: orgId } }),
  ]);

  return (
    <div>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <ModulesPanel
        modules={modules}
        constraints={{ mailInUse: mailboxCount > 0 || sharedCount > 0 }}
      />
    </div>
  );
}
