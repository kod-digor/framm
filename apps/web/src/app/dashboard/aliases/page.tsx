import { getOrgId, requireOrgAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { createAliasAction } from "@/app/actions/aliases";
import { CreateAliasForm } from "@/components/aliases/create-alias-form";
import { StalwartStatusBanner } from "@/components/stalwart/status-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/t";

export default async function AliasesPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session)!;
  const t = await getT("aliases");
  const params = await searchParams;

  const [aliases, domains] = await Promise.all([
    prisma.emailAlias.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.domain.findMany({
      where: { organizationId: orgId, status: { in: ["VERIFIED", "ACTIVE"] } },
      orderBy: { fqdn: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <StalwartStatusBanner namespace="aliases" />

      {params.created && (
        <p className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {t("created", { source: params.created })}
        </p>
      )}

      {params.error === "exists" && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {t("exists")}
        </p>
      )}

      {params.error === "stalwart" && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {t("stalwartError")}
        </p>
      )}

      {domains.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("add")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateAliasForm
              action={createAliasAction}
              domains={domains.map((d) => ({ id: d.id, fqdn: d.fqdn }))}
            />
          </CardContent>
        </Card>
      ) : (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("noDomain")}
        </p>
      )}

      {aliases.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("empty")}</p>
      ) : (
        <div className="space-y-3">
          {aliases.map((alias) => (
            <Card key={alias.id}>
              <CardContent className="flex flex-wrap items-center gap-3 pt-6 text-sm">
                <code className="rounded bg-zinc-50 px-2 py-1 font-mono text-zinc-900">
                  {alias.source}
                </code>
                <span className="text-zinc-400">→</span>
                <code className="rounded bg-zinc-50 px-2 py-1 font-mono text-zinc-700">
                  {alias.destination}
                </code>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
