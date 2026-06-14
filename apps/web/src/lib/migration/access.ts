import { auth } from "@/lib/auth";
import { canAdminOrg, getMembership } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export async function requireMigrationAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: "unauthorized" as const };

  const orgId = session.user.organizationId;
  if (!orgId) return { error: "forbidden" as const };

  const membership = await getMembership(session.user.id, orgId);
  if (!membership) return { error: "forbidden" as const };

  if (!canAdminOrg(session.user.role, membership.role)) {
    return { error: "forbidden" as const };
  }

  return { session, orgId, userId: session.user.id };
}

export async function resolveMigrationForAdmin(migrationId: string) {
  const authResult = await requireMigrationAdmin();
  if ("error" in authResult) return authResult;

  const migration = await prisma.mailboxMigration.findFirst({
    where: {
      id: migrationId,
      organizationId: authResult.orgId,
    },
    include: {
      mailbox: { select: { id: true, address: true, credentialsEnc: true } },
    },
  });

  if (!migration) return { error: "not_found" as const };

  return { ...authResult, migration };
}

export async function resolveMailboxForAdmin(mailboxId: string) {
  const authResult = await requireMigrationAdmin();
  if ("error" in authResult) return authResult;

  const mailbox = await prisma.mailbox.findFirst({
    where: {
      id: mailboxId,
      organizationId: authResult.orgId,
    },
  });

  if (!mailbox) return { error: "not_found" as const };

  return { ...authResult, mailbox };
}
