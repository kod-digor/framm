"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, signOut, unstable_update } from "@/lib/auth";
import { getMembership } from "@/lib/tenant";

export async function switchTenantAction(organizationId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const member = await getMembership(session.user.id, organizationId);
  if (!member) redirect("/dashboard?tenant=forbidden");

  await unstable_update({
    user: {
      organizationId: member.organizationId,
      organizationStatus: member.organization.status,
      membershipRole: member.role,
    },
  });

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
