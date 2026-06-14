import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getT } from "@/i18n/t";

export async function SignupCta() {
  const t = await getT("association");

  return (
    <section className="bg-encre px-6 py-20 text-white">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("cta.title")}</h2>
        <p className="mt-4 text-white/70">{t("cta.subtitle")}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            asChild
            size="lg"
            variant="outline"
            className="w-full border-white/30 bg-white text-encre hover:bg-white/90 sm:w-auto"
          >
            <Link href="/signup">{t("cta.signup")}</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="ghost"
            className="w-full text-white hover:bg-white/10 sm:w-auto"
          >
            <Link href="/login">{t("cta.login")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
