import { redirect } from "next/navigation";
import { getOrgId, requireOrgAdmin } from "@/lib/auth-utils";
import { getOrganizationModules } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getT } from "@/i18n/t";

export default async function AccountingPage() {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session)!;
  const modules = await getOrganizationModules(orgId);
  const t = await getT("modulePlaceholders");

  if (!modules.accounting) {
    redirect("/dashboard/modules");
  }

  return (
    <div>
      <PageHeader title={t("accounting.title")} description={t("accounting.subtitle")} />
      <Card className="max-w-lg border-canal shadow-none">
        <CardContent className="py-8 text-center">
          <p className="text-sm text-ardoise/70">{t("accounting.body")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
