import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { canAdminOrg, getMembership } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export type MigrationAccessError = {
  error: "unauthorized" | "forbidden" | "not_found";
};

type MigrationAdminContext = {
  session: Session;
  orgId: string;
  userId: string;
};

const migrationForAdminInclude = {
  mailbox: { select: { id: true, address: true, credentialsEnc: true } },
} as const;

export type MigrationForAdmin = MigrationAdminContext & {
  migration: NonNullable<
    Awaited<
      ReturnType<
        typeof prisma.mailboxMigration.findFirst<{
          include: typeof migrationForAdminInclude;
        }>
      >
    >
  >;
};

export type MailboxForAdmin = MigrationAdminContext & {
  mailbox: NonNullable<Awaited<ReturnType<typeof prisma.mailbox.findFirst>>>;
};

export type MigrationAdminAuthError = {
  error: "unauthorized" | "forbidden";
};

export async function requireMigrationAdmin(): Promise<
  MigrationAdminAuthError | MigrationAdminContext
> {
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

export async function resolveMigrationForAdmin(
  migrationId: string
): Promise<MigrationAccessError | MigrationForAdmin> {
  const authResult = await requireMigrationAdmin();
  if ("error" in authResult) {
    return { error: authResult.error };
  }

  const migration = await prisma.mailboxMigration.findFirst({
    where: {
      id: migrationId,
      organizationId: authResult.orgId,
    },
    include: migrationForAdminInclude,
  });

  if (!migration) return { error: "not_found" };

  return { ...authResult, migration };
}

export async function resolveMailboxForAdmin(
  mailboxId: string
): Promise<MigrationAccessError | MailboxForAdmin> {
  const authResult = await requireMigrationAdmin();
  if ("error" in authResult) {
    return { error: authResult.error };
  }

  const mailbox = await prisma.mailbox.findFirst({
    where: {
      id: mailboxId,
      organizationId: authResult.orgId,
    },
  });

  if (!mailbox) return { error: "not_found" };

  return { ...authResult, mailbox };
}
