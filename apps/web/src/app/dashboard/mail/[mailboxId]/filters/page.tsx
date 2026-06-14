import Link from "next/link";
import { notFound } from "next/navigation";
import { MailboxFiltersCrud } from "@/components/mail/mailbox-filters-crud";
import { requireAuth } from "@/lib/auth-utils";
import { resolveAuthorizedMailbox } from "@/lib/mail/mailbox-access";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { getT } from "@/i18n/t";

export default async function MailboxFiltersPage({
  params,
}: {
  params: Promise<{ mailboxId: string }>;
}) {
  const { mailboxId } = await params;
  await requireAuth();
  const t = await getT("mailFilters");

  const access = await resolveAuthorizedMailbox(mailboxId);
  if ("error" in access) {
    if (access.error === "not_found" || access.error === "forbidden") notFound();
    throw new Error(access.error);
  }

  const filters = await prisma.mailboxFilter.findMany({
    where: { mailboxId },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href={`/dashboard/mail/${mailboxId}`}>{t("backToMail")}</Link>
        </Button>
      </div>
      <MailboxFiltersCrud
        mailboxId={mailboxId}
        mailboxAddress={access.mailbox.address}
        filters={filters}
      />
    </div>
  );
}
