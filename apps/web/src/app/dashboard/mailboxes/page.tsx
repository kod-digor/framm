import Link from "next/link";
import { getOrgId, requireOrgAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { createMailboxAction } from "@/app/actions/mailboxes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/t";

export default async function MailboxesPage() {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session)!;
  const t = await getT("mailboxes");

  const [mailboxes, domains] = await Promise.all([
    prisma.mailbox.findMany({ where: { organizationId: orgId }, include: { domain: true } }),
    prisma.domain.findMany({
      where: { organizationId: orgId, status: { in: ["VERIFIED", "ACTIVE"] } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("add")}</h1>

      {domains.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <form action={createMailboxAction} className="flex flex-wrap gap-2">
              <div>
                <Label htmlFor="localPart">{t("address")}</Label>
                <Input id="localPart" name="localPart" placeholder="contact" required />
              </div>
              <div>
                <Label htmlFor="domainId">Domaine</Label>
                <select
                  id="domainId"
                  name="domainId"
                  className="flex h-10 rounded-md border border-zinc-200 px-3 text-sm"
                  required
                >
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>
                      @{d.fqdn}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" className="self-end">
                {t("add")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {mailboxes.map((mb) => (
          <Card key={mb.id}>
            <CardHeader>
              <CardTitle>
                <Link href={`/dashboard/mailboxes/${mb.id}`} className="hover:underline">
                  {mb.address}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-zinc-600">
              {t("quota")} : {Number(mb.usedBytes)} / {Number(mb.quotaBytes)} octets
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
