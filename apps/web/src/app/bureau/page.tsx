import Link from "next/link";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { approveOrganization, rejectOrganization } from "@/app/actions/bureau";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/t";

export default async function BureauPage() {
  await requireAuth(["BUREAU"]);
  const t = await getT("bureau");

  const pending = await prisma.organization.findMany({
    where: { status: "PENDING", slug: { not: "kod-digor" } },
    include: { users: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Button variant="outline" asChild>
          <Link href="/dashboard">{t("myOrg")}</Link>
        </Button>
      </div>
      <h2 className="mb-4 text-lg font-medium">{t("pending")}</h2>

      {pending.length === 0 ? (
        <p className="text-zinc-600">{t("noPending")}</p>
      ) : (
        <div className="space-y-4">
          {pending.map((org) => (
            <Card key={org.id}>
              <CardHeader>
                <CardTitle>{org.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-zinc-600 whitespace-pre-wrap">{org.presentation}</p>
                <p className="text-sm">
                  Admin : {org.users[0]?.email}
                </p>
                <div className="flex gap-2">
                  <form action={approveOrganization.bind(null, org.id)}>
                    <Button type="submit">{t("approve")}</Button>
                  </form>
                  <form action={async (fd) => {
                    "use server";
                    const reason = (fd.get("reason") as string) || "Refusé";
                    await rejectOrganization(org.id, reason);
                  }} className="flex gap-2">
                    <input
                      name="reason"
                      placeholder={t("rejectReason")}
                      className="rounded-md border border-zinc-200 px-2 text-sm"
                    />
                    <Button type="submit" variant="destructive">
                      {t("reject")}
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
