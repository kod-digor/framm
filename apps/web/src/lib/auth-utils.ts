import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { canAdminOrg, getMembership } from "@/lib/tenant";
import { getSubscription, requiresBillingSetup } from "@/lib/modules";
import { prisma } from "@/lib/prisma";
import { isDbUnavailableError } from "@/lib/auth-errors";

type RequireAuthOptions = {
  /** Autorise l'accès même si le changement de mot de passe est requis. */
  skipPasswordChange?: boolean;
};

type RequireOrgAdminOptions = {
  /** Autorise l'accès même si le paiement CB n'est pas finalisé (page facturation). */
  allowPendingBilling?: boolean;
  skipPasswordChange?: boolean;
};

async function enforcePasswordChange(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mustChangePassword: true },
    });
    if (user?.mustChangePassword) {
      redirect("/change-password");
    }
  } catch (err) {
    if (isDbUnavailableError(err)) return;
    throw err;
  }
}

export async function requireAuth(roles?: UserRole[], options?: RequireAuthOptions) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (roles && !roles.includes(session.user.role)) redirect("/");
  if (!options?.skipPasswordChange) {
    await enforcePasswordChange(session.user.id);
  }
  return session;
}

export async function requireOrgAdmin(options?: RequireOrgAdminOptions) {
  const session = await requireAuth(undefined, {
    skipPasswordChange: options?.skipPasswordChange,
  });
  if (!session.user.organizationId) redirect("/dashboard?tenant=none");

  const membership = await getMembership(session.user.id, session.user.organizationId);
  if (!membership) redirect("/login?error=session");

  if (!canAdminOrg(session.user.role, membership.role)) {
    redirect("/dashboard");
  }

  if (!options?.allowPendingBilling && session.user.role !== "BUREAU") {
    const subscription = await getSubscription(membership.organizationId);
    if (requiresBillingSetup(subscription?.status)) {
      redirect("/dashboard/billing");
    }
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
