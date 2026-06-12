import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { canAdminOrg, getMembership } from "@/lib/tenant";

export async function requireAuth(roles?: UserRole[]) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (roles && !roles.includes(session.user.role)) redirect("/");
  return session;
}

export async function requireOrgAdmin() {
  const session = await requireAuth();
  if (!session.user.organizationId) redirect("/dashboard?tenant=none");

  const membership = await getMembership(session.user.id, session.user.organizationId);
  if (!membership) redirect("/login?error=session");

  if (!canAdminOrg(session.user.role, membership.role)) {
    redirect("/dashboard");
  }

  if (session.user.role !== "BUREAU" && membership.organization.status !== "APPROVED") {
    redirect("/dashboard?tenant=pending");
  }

  return session;
}

export function getOrgId(session: {
  user: { organizationId: string | null };
}) {
  return session.user.organizationId;
}

export async function resolveOrgId(session: {
  user: { id: string; organizationId: string | null };
}) {
  if (!session.user.organizationId) return null;
  const member = await getMembership(session.user.id, session.user.organizationId);
  return member?.organizationId ?? null;
}
