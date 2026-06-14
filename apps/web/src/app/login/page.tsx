import Link from "next/link";
import { loginAction } from "@/app/actions/auth";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/t";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const t = await getT("auth");
  const tc = await getT("common");
  const params = await searchParams;
  const callbackUrl =
    typeof params.callbackUrl === "string" ? params.callbackUrl : "";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <BrandLogo alt={tc("appName")} href="/" size="sm" />
      </div>
      <Card className="w-full max-w-sm border-canal shadow-none">
        <CardHeader className="border-0 pb-0 text-center">
          <CardTitle className="text-base font-semibold">{t("loginTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {params.error === "session" && (
            <p className="mb-4 text-sm text-red-600">{t("sessionExpired")}</p>
          )}
          {params.error === "invalid" && (
            <p className="mb-4 text-sm text-red-600">{t("invalidCredentials")}</p>
          )}
          {params.error === "db" && (
            <p className="mb-4 text-sm text-ambre">{t("dbUnavailable")}</p>
          )}
          <form action={loginAction} className="space-y-4">
            {callbackUrl ? (
              <input type="hidden" name="callbackUrl" value={callbackUrl} />
            ) : null}
            <div>
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                spellCheck={false}
                required
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1.5"
              />
            </div>
            <Button type="submit" className="w-full">
              {t("loginTitle")}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-ardoise/60">
            <Link href="/signup" className="text-encre hover:underline">
              {t("signupTitle")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
