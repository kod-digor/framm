import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getT } from "@/i18n/t";

export default async function LandingPage() {
  const t = await getT("landing");
  const tc = await getT("common");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-zinc-50 to-white px-4">
      <div className="max-w-2xl text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-zinc-900 md:text-5xl">
          {tc("appName")}
        </h1>
        <p className="mb-4 text-xl font-medium text-zinc-700">{t("title")}</p>
        <p className="mb-8 text-lg text-zinc-600">{t("subtitle")}</p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/login">{t("ctaLogin")}</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/signup">{t("ctaSignup")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
