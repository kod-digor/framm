import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";

export async function requireAuth(roles?: UserRole[]) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (roles && !roles.includes(session.user.role)) redirect("/");
  return session;
}

export async function requireOrgAdmin() {
  const session = await requireAuth(["ASSOC_ADMIN", "BUREAU"]);
  if (session.user.role === "BUREAU") {
    if (!session.user.organizationId) redirect("/bureau");
    return session;
  }
  if (session.user.organizationStatus !== "APPROVED") {
    redirect("/login");
  }
  return session;
}

export function getOrgId(session: { user: { role: UserRole; organizationId: string | null } }) {
  if (!session.user.organizationId) return null;
  return session.user.organizationId;
}
