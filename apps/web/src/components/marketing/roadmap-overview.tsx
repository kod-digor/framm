import {
  getTaskProgress,
  getTimelineBounds,
  monthToIndex,
  PRODUCT_DEFINITIONS,
} from "@/lib/products-catalog";
import { getT } from "@/i18n/t";
import { productText, asStringTranslator } from "@/i18n/product-messages";

export async function RoadmapOverview() {
  const t = await getT("roadmap");
  const tp = asStringTranslator(await getT("products"));
  const bounds = getTimelineBounds();
  const totalMonths =
    monthToIndex(bounds.end, bounds.start) - monthToIndex(bounds.start, bounds.start) + 1;

  return (
    <div className="space-y-3">
      {PRODUCT_DEFINITIONS.map((product) => {
        const progress = getTaskProgress(product);
        const tasks = product.phases.flatMap((p) => p.tasks);
        const earliest = tasks.reduce(
          (min, task) => (task.startMonth < min ? task.startMonth : min),
          bounds.end
        );
        const latest = tasks.reduce(
          (max, task) => (task.endMonth > max ? task.endMonth : max),
          bounds.start
        );
        const startOffset = monthToIndex(earliest, bounds.start);
        const span = monthToIndex(latest, bounds.start) - startOffset + 1;
        const leftPct = (startOffset / totalMonths) * 100;
        const widthPct = (span / totalMonths) * 100;

        return (
          <div key={product.key} className="flex items-center gap-4">
            <span className="w-36 shrink-0 truncate text-sm text-ardoise">
              {productText(tp, product.key, "title")}
            </span>
            <div className="relative h-6 flex-1 rounded-full bg-neutral-100">
              <div
                className="absolute top-1 h-4 rounded-full bg-encre/20"
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              />
              <div
                className="absolute top-1 h-4 rounded-full bg-encre"
                style={{
                  left: `${leftPct}%`,
                  width: `${(widthPct * progress) / 100}%`,
                }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-xs font-mono-data text-ardoise/50">
              {progress}%
            </span>
          </div>
        );
      })}
      <p className="text-xs text-ardoise/40">{t("horizon")}</p>
    </div>
  );
}
