import Link from "next/link";
import { loginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/i18n/t";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const t = await getT("auth");
  const params = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("loginTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {params.error === "session" && (
            <p className="mb-4 text-sm text-red-600">{t("sessionExpired")}</p>
          )}
          {params.error && params.error !== "session" && (
            <p className="mb-4 text-sm text-red-600">{t("invalidCredentials")}</p>
          )}
          <form action={loginAction} className="space-y-4">
            <div>
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div>
              <Label htmlFor="password">{t("password")}</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            <Button type="submit" className="w-full">
              {t("loginTitle")}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-zinc-600">
            <Link href="/signup" className="underline">
              {t("signupTitle")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
