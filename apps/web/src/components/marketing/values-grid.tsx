import { Heart, Lock, Globe, Coins, Code, Users } from "lucide-react";
import { getT } from "@/i18n/t";

const VALUE_KEYS = [
  { key: "freedom", icon: Heart },
  { key: "sovereignty", icon: Globe },
  { key: "fairPricing", icon: Coins },
  { key: "privacy", icon: Lock },
  { key: "opensource", icon: Code },
  { key: "accessibility", icon: Users },
] as const;

export async function ValuesGrid() {
  const t = await getT("association");

  return (
    <section className="bg-encre-muted/30 px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-ardoise sm:text-3xl">
            {t("values.title")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ardoise/60">{t("values.subtitle")}</p>
        </div>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VALUE_KEYS.map(({ key, icon: Icon }) => (
            <li
              key={key}
              className="rounded-xl border border-canal bg-white p-6"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-encre-muted">
                <Icon className="size-5 text-encre" aria-hidden />
              </div>
              <h3 className="mt-4 font-medium text-ardoise">
                {t(`values.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ardoise/60">
                {t(`values.${key}.description`)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
