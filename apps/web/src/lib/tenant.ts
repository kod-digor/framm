import { prisma } from "@/lib/prisma";
import type { OrganizationStatus, UserRole } from "@prisma/client";

export async function getUserMemberships(userId: string) {
  return prisma.organizationMember.findMany({
    where: { userId },
    include: { organization: true },
    orderBy: { organization: { name: "asc" } },
  });
}

export async function getDefaultMembership(userId: string) {
  const memberships = await getUserMemberships(userId);
  return (
    memberships.find((m) => m.organization.status === "APPROVED") ?? memberships[0] ?? null
  );
}

export async function getMembership(userId: string, organizationId: string) {
  return prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    include: { organization: true },
  });
}

export function canAccessDashboard(
  globalRole: UserRole,
  membershipRole: UserRole | null,
  orgStatus: OrganizationStatus | null
) {
  if (globalRole === "BUREAU") return !!orgStatus;
  return (
    membershipRole === "ASSOC_ADMIN" &&
    orgStatus === "APPROVED"
  );
}

export function canAdminOrg(globalRole: UserRole, membershipRole: UserRole | null) {
  if (globalRole === "BUREAU") return true;
  return membershipRole === "ASSOC_ADMIN";
}
