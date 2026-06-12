import { getOrgId, requireOrgAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { addDomainAction, verifyDomainAction } from "@/app/actions/domains";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/t";

export default async function DomainsPage() {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session)!;
  const t = await getT("domains");

  const domains = await prisma.domain.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("add")}</h1>

      <Card>
        <CardContent className="pt-6">
          <form action={addDomainAction} className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="fqdn">{t("fqdn")}</Label>
              <Input id="fqdn" name="fqdn" placeholder="monasso.bzh" required />
            </div>
            <Button type="submit" className="self-end">
              {t("add")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {domains.map((domain) => (
          <Card key={domain.id}>
            <CardHeader>
              <CardTitle>{domain.fqdn}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-zinc-600">
                {domain.status === "VERIFIED" || domain.status === "ACTIVE"
                  ? t("verified")
                  : t("pending")}
              </p>
              {domain.dnsRecordsJson && (
                <pre className="rounded bg-zinc-50 p-3 text-xs overflow-x-auto">
                  {JSON.stringify(domain.dnsRecordsJson, null, 2)}
                </pre>
              )}
              <form action={verifyDomainAction.bind(null, domain.id)}>
                <Button type="submit" variant="outline">
                  {t("verify")}
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
