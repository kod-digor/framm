import { getOrgId, requireOrgAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { getOrgStorageBytes } from "@/lib/storage/s3";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/t";

function formatBytes(bytes: bigint) {
  const n = Number(bytes);
  if (n < 1024) return `${n} o`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} Ko`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} Mo`;
  return `${(n / 1024 ** 3).toFixed(2)} Go`;
}

export default async function UsagePage() {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session)!;
  const t = await getT("usage");

  const [storage, mailboxCount, domainCount, snapshots] = await Promise.all([
    getOrgStorageBytes(orgId),
    prisma.mailbox.count({ where: { organizationId: orgId } }),
    prisma.domain.count({
      where: { organizationId: orgId, status: { in: ["VERIFIED", "ACTIVE"] } },
    }),
    prisma.usageSnapshot.findMany({
      where: { organizationId: orgId },
      orderBy: { recordedAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("storage")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatBytes(storage)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("mailboxes")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{mailboxCount}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("domains")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{domainCount}</CardContent>
        </Card>
      </div>

      {snapshots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historique</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-zinc-600">
              {snapshots.map((s) => (
                <li key={s.id}>
                  {s.metric} : {s.value.toString()} — {s.recordedAt.toLocaleString("fr-FR")}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
