"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgAdmin, resolveOrgId } from "@/lib/auth-utils";
import {
  createSignupPayment,
  fetchPayplugPayment,
  isPaidSignupPayment,
  isPayplugConfigured,
} from "@/lib/billing/payplug";
import { activateSubscription, getSubscription, isSubscriptionActive } from "@/lib/modules";
import { prisma } from "@/lib/prisma";

/** Vérifie le paiement PayPlug enregistré et active l'abonnement si payé. */
export async function syncBillingFromPayplug(orgId: string): Promise<boolean> {
  const subscription = await getSubscription(orgId);
  if (!subscription?.payplugPaymentId) return false;
  if (isSubscriptionActive(subscription.status)) return true;

  const payment = await fetchPayplugPayment(subscription.payplugPaymentId);
  if (!payment || !isPaidSignupPayment(payment, orgId)) return false;

  await activateSubscription(orgId, payment.id, payment.customer?.id);
  return true;
}

/** Relance le flux paiement PayPlug pour une org en attente. */
export async function retryBillingPaymentAction() {
  const session = await requireOrgAdmin({ allowPendingBilling: true });
  const orgId = await resolveOrgId(session);
  if (!orgId) redirect("/login?error=session");

  if (!isPayplugConfigured()) {
    redirect("/dashboard/billing?error=payplug_required");
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { members: { include: { user: true }, take: 1 } },
  });
  const adminEmail = org?.members[0]?.user.email;
  if (!org || !adminEmail) redirect("/dashboard/billing?error=invalid");

  const activated = await syncBillingFromPayplug(orgId);
  if (activated) {
    revalidatePath("/dashboard/billing");
    revalidatePath("/dashboard");
    redirect("/dashboard?billing=activated");
  }

  const paymentResult = await createSignupPayment({
    email: adminEmail,
    organizationId: orgId,
    organizationName: org.name,
  });

  if (paymentResult?.paymentId) {
    await prisma.subscription.update({
      where: { organizationId: orgId },
      data: {
        payplugPaymentId: paymentResult.paymentId,
        ...(paymentResult.customerId ? { payplugCustomerId: paymentResult.customerId } : {}),
      },
    });
  }

  if (paymentResult?.paymentUrl) {
    redirect(paymentResult.paymentUrl);
  }

  redirect("/dashboard/billing?error=payment_failed");
}
