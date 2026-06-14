import { retryBillingPaymentAction, syncBillingFromPayplug } from "@/app/actions/billing";
import { activateBillingStubAction } from "@/app/actions/modules";
import { getOrgId, requireOrgAdmin } from "@/lib/auth-utils";
import { formatSignupPriceEur, isPayplugConfigured } from "@/lib/billing/payplug";
import { getSubscription, isSubscriptionActive } from "@/lib/modules";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/t";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{
    paid?: string;
    stub?: string;
    setup?: string;
    error?: string;
  }>;
}) {
  const session = await requireOrgAdmin({ allowPendingBilling: true });
  const orgId = getOrgId(session)!;
  const t = await getT("billing");
  const params = await searchParams;
  const payplugReady = isPayplugConfigured();

  if (params.paid === "1" && payplugReady) {
    await syncBillingFromPayplug(orgId);
  }

  const subscription = await getSubscription(orgId);
  const active = isSubscriptionActive(subscription?.status);
  const priceLabel = formatSignupPriceEur();

  return (
    <div>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Card className="max-w-xl border-canal shadow-none">
        <CardHeader>
          <CardTitle className="text-base">{t("cardTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {active ? (
            <p className="text-sm text-emerald-700" role="status">
              {t("active")}
            </p>
          ) : (
            <>
              <p className="text-sm text-ardoise/70">{t("pending")}</p>
              {payplugReady && (
                <p className="text-sm text-ardoise/60">{t("priceHint", { price: priceLabel })}</p>
              )}
              {params.paid === "1" && !active && (
                <p className="rounded-lg bg-encre-muted px-3 py-2 text-sm" role="status" aria-live="polite">
                  {t("returnPending")}
                </p>
              )}
              {params.stub === "1" && !payplugReady && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {t("stubMode")}
                </p>
              )}
              {!payplugReady && (
                <form action={activateBillingStubAction}>
                  <Button type="submit" variant="outline">
                    {t("activateStub")}
                  </Button>
                </form>
              )}
              {payplugReady && (
                <form action={retryBillingPaymentAction}>
                  <Button type="submit">{active ? t("managePayment") : t("payWithCard")}</Button>
                </form>
              )}
              {payplugReady && params.setup === "1" && (
                <p className="text-sm text-ardoise/60">{t("payplugRedirectHint")}</p>
              )}
            </>
          )}
          {params.error === "payplug_required" && (
            <p className="text-sm text-red-700" role="alert">
              {t("payplugRequired")}
            </p>
          )}
          {params.error === "payment_failed" && (
            <p className="text-sm text-red-700" role="alert">
              {t("paymentFailed")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
