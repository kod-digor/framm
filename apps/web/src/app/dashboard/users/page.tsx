import { Suspense } from "react";
import { getOrgId, requireOrgAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { UsersCrud } from "@/components/users/users-crud";
import { StalwartStatusBanner } from "@/components/stalwart/status-banner";
import { isDnsVerifiedDomainStatus, MAIL_USABLE_DOMAIN_STATUSES } from "@/lib/domain-status";
import {
  getActiveMigrationsForOrg,
  serializeMigrationStatus,
} from "@/lib/migration/orchestrator";

export default async function UsersPage() {
  const session = await requireOrgAdmin();
  const orgId = getOrgId(session)!;

  const [members, domains, activeMigrations] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          include: {
            mailboxes: {
              where: { organizationId: orgId },
              include: {
                mailbox: {
                  include: {
                    alternateAddresses: { orderBy: { address: "asc" } },
                    delegations: {
                      include: {
                        delegateUser: {
                          select: { id: true, email: true, displayName: true },
                        },
                      },
                      orderBy: { createdAt: "asc" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.domain.findMany({
      where: { organizationId: orgId, status: { in: MAIL_USABLE_DOMAIN_STATUSES } },
      orderBy: { fqdn: "asc" },
    }),
    getActiveMigrationsForOrg(orgId),
  ]);

  const activeMigrationsByMailbox = Object.fromEntries(
    activeMigrations.map((migration) => [
      migration.mailboxId,
      serializeMigrationStatus(migration),
    ])
  );

  const domainOptions = domains.map((d) => ({
    id: d.id,
    fqdn: d.fqdn,
    isDnsVerified: isDnsVerifiedDomainStatus(d.status),
  }));

  const orgMembers = members.map((m) => ({
    userId: m.user.id,
    label: m.user.displayName ?? m.user.email,
    email: m.user.email,
  }));

  const users = members.map((member) => {
    const primaryLink = member.user.mailboxes.find((l) => l.isPrimary) ?? member.user.mailboxes[0];
    const mailbox = primaryLink?.mailbox;

    return {
      memberId: member.id,
      userId: member.user.id,
      userEmail: member.user.email,
      displayName: member.user.displayName ?? mailbox?.displayName ?? null,
      primaryAddress: mailbox?.address ?? null,
      mailboxId: mailbox?.id ?? null,
      mustChangePassword: member.user.mustChangePassword,
      alternateAddresses:
        mailbox?.alternateAddresses.map((alt) => ({
          id: alt.id,
          address: alt.address,
          patternType: alt.patternType,
        })) ?? [],
      delegationsGranted:
        mailbox?.delegations.map((d) => ({
          id: d.id,
          delegateUserId: d.delegateUserId,
          label: d.delegateUser.displayName ?? d.delegateUser.email,
          email: d.delegateUser.email,
          permission: d.permission,
        })) ?? [],
    };
  });

  return (
    <div className="space-y-6">
      <StalwartStatusBanner namespace="users" />
      <Suspense fallback={null}>
        <UsersCrud
          users={users}
          domains={domains.map((d) => ({ id: d.id, fqdn: d.fqdn }))}
          domainOptions={domainOptions}
          orgMembers={orgMembers}
          initialActiveMigrations={activeMigrationsByMailbox}
        />
      </Suspense>
    </div>
  );
}
