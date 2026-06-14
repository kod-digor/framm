"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgAdmin, resolveOrgId } from "@/lib/auth-utils";
import { activateSubscription } from "@/lib/modules";
import { isPayplugConfigured } from "@/lib/billing/payplug";
import { prisma } from "@/lib/prisma";
import type { ModuleKey } from "@/lib/modules-catalog";
import { z } from "zod";

const moduleSchema = z.object({
  module: z.enum(["mail", "calendar", "accounting", "members"]),
  enabled: z.enum(["true", "false"]),
});

export async function toggleModuleAction(formData: FormData) {
  const session = await requireOrgAdmin({ allowPendingBilling: true });
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  const parsed = moduleSchema.safeParse({
    module: formData.get("module"),
    enabled: formData.get("enabled"),
  });
  if (!parsed.success) return;

  const { module, enabled } = parsed.data;
  const value = enabled === "true";

  if (module === "mail" && !value) {
    const [mailboxCount, sharedCount] = await Promise.all([
      prisma.mailbox.count({ where: { organizationId: orgId, isShared: false } }),
      prisma.sharedMailbox.count({ where: { organizationId: orgId } }),
    ]);
    if (mailboxCount > 0 || sharedCount > 0) {
      revalidatePath("/dashboard/modules");
      return;
    }
  }

  await prisma.organizationModule.upsert({
    where: { organizationId: orgId },
    create: {
      organizationId: orgId,
      mail: module === "mail" ? value : true,
      calendar: module === "calendar" ? value : false,
      accounting: module === "accounting" ? value : false,
      members: module === "members" ? value : false,
    },
    update: { [module as ModuleKey]: value },
  });

  revalidatePath("/dashboard/modules");
  revalidatePath("/dashboard");
}

/** Stub dev : active l'abonnement sans PayPlug (org admin uniquement). */
export async function activateBillingStubAction() {
  const session = await requireOrgAdmin({ allowPendingBilling: true });
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  if (isPayplugConfigured()) {
    redirect("/dashboard/billing?error=payplug_required");
  }

  await activateSubscription(orgId);
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard");
  redirect("/dashboard?billing=activated");
}
