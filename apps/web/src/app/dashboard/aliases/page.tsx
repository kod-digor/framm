import { getOrgId, requireOrgAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { createAliasAction } from "@/app/actions/aliases";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/t";

export default async function AliasesPage() {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session)!;
  const t = await getT("aliases");

  const aliases = await prisma.emailAlias.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("add")}</h1>

      <Card>
        <CardContent className="pt-6">
          <form action={createAliasAction} className="grid gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="source">{t("source")}</Label>
              <Input id="source" name="source" placeholder="info@monasso.bzh" required />
            </div>
            <div>
              <Label htmlFor="destination">{t("destination")}</Label>
              <Input id="destination" name="destination" placeholder="contact@monasso.bzh" required />
            </div>
            <Button type="submit" className="self-end">
              {t("add")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {aliases.map((alias) => (
          <Card key={alias.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {alias.source} → {alias.destination}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
