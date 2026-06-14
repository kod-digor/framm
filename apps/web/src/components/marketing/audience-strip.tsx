import { Building2, Home, Landmark, Users } from "lucide-react";
import { getT } from "@/i18n/t";

const AUDIENCES = [
  { key: "family", icon: Home, descKey: "familyDesc" },
  { key: "association", icon: Users, descKey: "associationDesc" },
  { key: "business", icon: Building2, descKey: "businessDesc" },
  { key: "collectivity", icon: Landmark, descKey: "collectivityDesc" },
] as const;

export async function AudienceStrip() {
  const t = await getT("association");

  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-ardoise sm:text-3xl">
          {t("audiences.title")}
        </h2>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCES.map(({ key, icon: Icon, descKey }) => (
            <li
              key={key}
              className="rounded-xl border border-canal bg-white p-6 text-center"
            >
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-encre-muted">
                <Icon className="size-6 text-encre" aria-hidden />
              </div>
              <h3 className="mt-4 font-medium text-ardoise">{t(`audiences.${key}`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ardoise/60">
                {t(`audiences.${descKey}`)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
