/**
 * Client PayPlug — paiement CB à l'inscription.
 * Docs : https://docs.payplug.com/api/
 *
 * Sécurité webhook : pas de signature HMAC — re-fetch du paiement via l'API PayPlug
 * (recommandation officielle « treat notification »).
 */

const PAYPLUG_API = "https://api.payplug.com/v1";

export type PayplugPaymentResult = {
  paymentId: string | null;
  paymentUrl: string | null;
  customerId: string | null;
};

export type PayplugPaymentResource = {
  id: string;
  object: string;
  is_paid: boolean;
  amount: number;
  metadata?: { organization_id?: string; purpose?: string };
  customer?: { id?: string };
};

export type PayplugNotification = {
  id?: string;
  object?: string;
};

export function isPayplugConfigured(): boolean {
  return Boolean(process.env.PAYPLUG_SECRET_KEY?.trim());
}

function getSecretKey(): string {
  const key = process.env.PAYPLUG_SECRET_KEY?.trim();
  if (!key) throw new Error("PAYPLUG_SECRET_KEY manquant");
  return key;
}

function signupAmountCents(): number {
  const raw = process.env.PAYPLUG_SIGNUP_AMOUNT_CENTS;
  if (!raw) return 100;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 100;
}

export function formatSignupPriceEur(): string {
  const cents = signupAmountCents();
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export type CreateSignupPaymentInput = {
  email: string;
  organizationId: string;
  organizationName: string;
};

function payplugReturnUrl(): string {
  return (
    process.env.PAYPLUG_RETURN_URL?.trim() ??
    `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/dashboard/billing?paid=1`
  );
}

function payplugNotificationUrl(): string {
  return (
    process.env.PAYPLUG_WEBHOOK_URL?.trim() ??
    `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/webhooks/payplug`
  );
}

async function createPaymentBody(input: CreateSignupPaymentInput) {
  return {
    amount: signupAmountCents(),
    currency: "EUR",
    billing: { email: input.email },
    shipping: { first_name: input.organizationName },
    hosted_payment: {
      return_url: payplugReturnUrl(),
    },
    notification_url: payplugNotificationUrl(),
    metadata: {
      organization_id: input.organizationId,
      purpose: "signup",
    },
  };
}

export async function createSignupPayment(
  input: CreateSignupPaymentInput
): Promise<PayplugPaymentResult | null> {
  if (!isPayplugConfigured()) return null;

  try {
    const res = await fetch(`${PAYPLUG_API}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getSecretKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(await createPaymentBody(input)),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[payplug] create payment failed:", res.status, body);
      return { paymentId: null, paymentUrl: null, customerId: null };
    }

    const data = (await res.json()) as {
      id?: string;
      hosted_payment?: { payment_url?: string };
      customer?: { id?: string };
    };

    return {
      paymentId: data.id ?? null,
      paymentUrl: data.hosted_payment?.payment_url ?? null,
      customerId: data.customer?.id ?? null,
    };
  } catch (err) {
    console.error("[payplug] create payment error:", err);
    return { paymentId: null, paymentUrl: null, customerId: null };
  }
}

/** Récupère un paiement depuis l'API PayPlug (source de vérité). */
export async function fetchPayplugPayment(paymentId: string): Promise<PayplugPaymentResource | null> {
  if (!isPayplugConfigured()) return null;

  try {
    const res = await fetch(`${PAYPLUG_API}/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${getSecretKey()}` },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[payplug] fetch payment failed:", res.status, paymentId);
      return null;
    }

    return (await res.json()) as PayplugPaymentResource;
  } catch (err) {
    console.error("[payplug] fetch payment error:", err);
    return null;
  }
}

export function parsePayplugNotification(body: unknown): PayplugNotification | null {
  if (!body || typeof body !== "object") return null;
  const n = body as PayplugNotification;
  if (!n.id || !n.object) return null;
  return n;
}

export function isPaidSignupPayment(payment: PayplugPaymentResource, organizationId: string): boolean {
  return (
    payment.object === "payment" &&
    payment.is_paid === true &&
    payment.metadata?.organization_id === organizationId &&
    payment.metadata?.purpose === "signup"
  );
}
