import Link from "next/link";
import { signupAction } from "@/app/actions/auth";
import { AuthEmailField } from "@/components/auth/auth-email-field";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/t";
import { getPlatformEmailDomains } from "@/lib/platform-domains";
import { formatSignupPriceEur, isPayplugConfigured } from "@/lib/billing/payplug";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const t = await getT("auth");
  const tc = await getT("common");
  const params = await searchParams;
  const emailDomains = getPlatformEmailDomains();
  const payplugReady = isPayplugConfigured();
  const priceLabel = formatSignupPriceEur();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <BrandLogo alt={tc("appName")} href="/" size="sm" />
      </div>
      <Card className="w-full max-w-lg border-canal shadow-none">
        <CardHeader className="border-0 pb-0 text-center">
          <CardTitle className="text-base font-semibold">{t("signupTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {params.error === "invalid" && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {t("invalidCredentials")}
            </p>
          )}
          <p className="mb-4 text-sm text-ardoise/60">{t("signupBillingHint")}</p>
          {payplugReady && (
            <p className="mb-4 text-sm text-ardoise/60">{t("signupPriceHint", { price: priceLabel })}</p>
          )}
          {!payplugReady && (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {t("signupPayplugStub")}
            </p>
          )}
          <p className="mb-4 text-sm text-ardoise/60">{t("signupExistingHint")}</p>
          <form action={signupAction} className="space-y-4">
            <div>
              <Label htmlFor="orgName">{t("orgName")}</Label>
              <Input
                id="orgName"
                name="orgName"
                required
                autoComplete="organization"
                className="mt-1.5"
              />
            </div>
            <AuthEmailField domains={emailDomains} />
            <div>
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
                className="mt-1.5"
              />
            </div>
            <Button type="submit" className="w-full">
              {t("signupSubmit")}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-ardoise/60">
            <Link href="/login" className="text-encre hover:underline">
              {t("loginTitle")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
