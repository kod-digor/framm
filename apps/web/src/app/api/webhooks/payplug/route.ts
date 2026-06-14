import { NextResponse } from "next/server";
import { activateSubscription } from "@/lib/modules";
import {
  fetchPayplugPayment,
  isPaidSignupPayment,
  isPayplugConfigured,
  parsePayplugNotification,
} from "@/lib/billing/payplug";

/**
 * Webhook PayPlug — re-fetch du paiement via API (authentification officielle).
 */
export async function POST(request: Request) {
  if (!isPayplugConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const notification = parsePayplugNotification(body);
  if (!notification || notification.object !== "payment" || !notification.id) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const payment = await fetchPayplugPayment(notification.id);
  if (!payment?.is_paid) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const organizationId = payment.metadata?.organization_id;
  if (!organizationId || !isPaidSignupPayment(payment, organizationId)) {
    return NextResponse.json({ error: "invalid_metadata" }, { status: 422 });
  }

  await activateSubscription(organizationId, payment.id, payment.customer?.id);

  return NextResponse.json({ ok: true });
}
