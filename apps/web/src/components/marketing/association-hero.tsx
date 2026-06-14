import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getT } from "@/i18n/t";
import { EcosystemSchematic } from "./ecosystem-schematic";

export async function AssociationHero() {
  const t = await getT("association");

  return (
    <section className="relative overflow-hidden px-6 py-20 sm:py-28">
      <EcosystemSchematic />
      <div className="relative mx-auto max-w-4xl text-center">
        <p className="text-sm font-medium tracking-wide text-encre uppercase">
          {t("hero.eyebrow")}
        </p>
        <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-ardoise sm:text-5xl lg:text-6xl">
          {t("hero.title")}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-ardoise/60">
          {t("hero.subtitle")}
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="w-full touch-manipulation sm:w-auto">
            <Link href="/signup">{t("hero.ctaSignup")}</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full touch-manipulation sm:w-auto">
            <Link href="/roadmap">{t("hero.ctaRoadmap")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
