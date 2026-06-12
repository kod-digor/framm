import Link from "next/link";
import { getOrgId, requireOrgAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { createMailboxAction } from "@/app/actions/mailboxes";
import { CreateMailboxForm } from "@/components/mailboxes/create-mailbox-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/t";
import { formatBytes } from "@/lib/utils";

export default async function MailboxesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session)!;
  const t = await getT("mailboxes");
  const params = await searchParams;

  const [mailboxes, domains] = await Promise.all([
    prisma.mailbox.findMany({
      where: { organizationId: orgId },
      include: { domain: true },
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

      {params.error === "password" && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {t("passwordError")}
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

      {params.created && (
        <p className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {t("created", { address: params.created })}
        </p>
      )}

      {domains.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("add")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateMailboxForm
              action={createMailboxAction}
              domains={domains.map((d) => ({ id: d.id, fqdn: d.fqdn }))}
            />
          </CardContent>
        </Card>
      ) : (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("noDomain")}
        </p>
      )}

      {mailboxes.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("empty")}</p>
      ) : (
        <div className="space-y-3">
          {mailboxes.map((mailbox) => {
            const used = Number(mailbox.usedBytes);
            const quota = Number(mailbox.quotaBytes);
            const percent = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;

            return (
              <Card key={mailbox.id}>
                <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <Link
                      href={`/dashboard/mailboxes/${mailbox.id}`}
                      className="block truncate text-lg font-semibold text-zinc-900 hover:underline"
                    >
                      {mailbox.address}
                    </Link>
                    <p className="text-sm text-zinc-500">
                      {t("domain")} : {mailbox.domain.fqdn}
                    </p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-zinc-500">
                        <span>{t("quota")}</span>
                        <span>
                          {formatBytes(used)} / {formatBytes(quota)}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full bg-zinc-900 transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="shrink-0">
                    <Link href={`/dashboard/mailboxes/${mailbox.id}`}>{t("config")}</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
