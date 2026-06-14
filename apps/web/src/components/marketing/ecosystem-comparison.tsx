import { Check } from "lucide-react";
import { getT } from "@/i18n/t";

const COMPARISON_POINTS = [
  "pointSovereign",
  "pointEncrypted",
  "pointNoLockIn",
  "pointNonProfit",
  "pointAllInOne",
] as const;

const ALTERNATIVES = ["vsMicrosoft", "vsGoogle", "vsApple", "vsOdoo"] as const;

export async function EcosystemComparison() {
  const t = await getT("association");

  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-ardoise sm:text-3xl">
            {t("comparison.title")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ardoise/60">{t("comparison.subtitle")}</p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <div className="rounded-xl border border-canal bg-white p-6">
            <h3 className="font-medium text-ardoise">Kod Digor</h3>
            <ul className="mt-4 space-y-3">
              {COMPARISON_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-ardoise/80">
                  <Check className="mt-0.5 size-4 shrink-0 text-verin" aria-hidden />
                  {t(`comparison.${point}`)}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-dashed border-canal bg-neutral-50/50 p-6">
            <h3 className="font-medium text-ardoise/60">{t("comparison.subtitle")}</h3>
            <ul className="mt-4 space-y-2">
              {ALTERNATIVES.map((alt) => (
                <li key={alt} className="text-sm text-ardoise/50">
                  {t(`comparison.${alt}`)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
