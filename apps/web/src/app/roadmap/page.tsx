import { MarketingShell } from "@/components/marketing/marketing-shell";
import { RoadmapOverview } from "@/components/marketing/roadmap-overview";
import { FilteredProductGrid } from "@/components/marketing/product-filter-bar";
import { getT } from "@/i18n/t";

export default async function RoadmapPage() {
  const t = await getT("roadmap");

  return (
    <MarketingShell activeNav="roadmap">
      <div className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight text-ardoise sm:text-4xl">
              {t("title")}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-ardoise/60">{t("subtitle")}</p>
          </div>

          <section className="mt-16">
            <h2 className="text-lg font-medium text-ardoise">{t("ecosystem.title")}</h2>
            <p className="mt-2 text-sm text-ardoise/60">{t("ecosystem.subtitle")}</p>
            <div className="mt-6 rounded-xl border border-canal bg-white p-6">
              <RoadmapOverview />
            </div>
          </section>

          <section className="mt-16">
            <FilteredProductGrid />
          </section>
        </div>
      </div>
    </MarketingShell>
  );
}
