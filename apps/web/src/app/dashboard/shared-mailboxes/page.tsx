import { getOrgId, requireOrgAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { SharedMailboxesCrud } from "@/components/shared-mailboxes/shared-mailboxes-crud";
import { StalwartStatusBanner } from "@/components/stalwart/status-banner";
import { isDnsVerifiedDomainStatus, MAIL_USABLE_DOMAIN_STATUSES } from "@/lib/domain-status";

export default async function SharedMailboxesPage() {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session)!;

  const [sharedMailboxes, domains, orgMembers] = await Promise.all([
    prisma.sharedMailbox.findMany({
      where: { organizationId: orgId },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, displayName: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { address: "asc" },
    }),
    prisma.domain.findMany({
      where: { organizationId: orgId, status: { in: MAIL_USABLE_DOMAIN_STATUSES } },
      orderBy: { fqdn: "asc" },
    }),
    prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, email: true, displayName: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const domainOptions = domains.map((d) => ({
    id: d.id,
    fqdn: d.fqdn,
    isDnsVerified: isDnsVerifiedDomainStatus(d.status),
  }));

  const memberOptions = orgMembers.map((m) => ({
    userId: m.user.id,
    label: m.user.displayName ?? m.user.email,
    email: m.user.email,
  }));

  const rows = sharedMailboxes.map((shared) => ({
    id: shared.id,
    address: shared.address,
    displayName: shared.displayName,
    mailboxId: shared.mailboxId,
    members: shared.members.map((member) => ({
      id: member.id,
      userId: member.userId,
      label: member.user.displayName ?? member.user.email,
      email: member.user.email,
    })),
  }));

  return (
    <div className="space-y-6">
      <StalwartStatusBanner namespace="sharedMailboxes" />
      <SharedMailboxesCrud
        sharedMailboxes={rows}
        domainOptions={domainOptions}
        orgMembers={memberOptions}
      />
    </div>
  );
}
