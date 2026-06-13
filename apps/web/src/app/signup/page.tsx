import Link from "next/link";
import { signupAction } from "@/app/actions/auth";
import { AuthEmailField } from "@/components/auth/auth-email-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/t";
import { getPlatformEmailDomains } from "@/lib/platform-domains";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const t = await getT("auth");
  const params = await searchParams;
  const emailDomains = getPlatformEmailDomains();

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{t("signupTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {params.success === "pending" && (
            <p className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
              {t("signupPending")}
            </p>
          )}
          {params.error === "invalid" && (
            <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
              {t("invalidCredentials")}
            </p>
          )}
          <p className="mb-4 text-sm text-zinc-600">{t("signupExistingHint")}</p>
          <form action={signupAction} className="space-y-4">
            <div>
              <Label htmlFor="orgName">{t("orgName")}</Label>
              <Input id="orgName" name="orgName" required />
            </div>
            <div>
              <Label htmlFor="presentation">{t("presentation")}</Label>
              <textarea
                id="presentation"
                name="presentation"
                required
                minLength={20}
                rows={4}
                className="flex w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-zinc-500">{t("presentationHint")}</p>
            </div>
            <AuthEmailField domains={emailDomains} />
            <div>
              <Label htmlFor="password">{t("password")}</Label>
              <Input id="password" name="password" type="password" minLength={8} required />
            </div>
            <Button type="submit" className="w-full">
              {t("signupTitle")}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-zinc-600">
            <Link href="/login" className="underline">
              {t("loginTitle")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
