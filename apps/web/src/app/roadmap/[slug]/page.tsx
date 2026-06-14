import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { ProductStatusBadge } from "@/components/marketing/product-status-badge";
import { RoadmapGantt } from "@/components/marketing/roadmap-gantt";
import { RoadmapTaskTable } from "@/components/marketing/roadmap-task-table";
import {
  getAdjacentProducts,
  getAllProductSlugs,
  getProductBySlug,
  getTaskProgress,
} from "@/lib/products-catalog";
import { getT } from "@/i18n/t";
import { productText, asStringTranslator } from "@/i18n/product-messages";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllProductSlugs().map((slug) => ({ slug }));
}

export default async function ProductRoadmapPage({ params }: PageProps) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const t = await getT("roadmap");
  const tp = asStringTranslator(await getT("products"));
  const { prev, next } = getAdjacentProducts(slug);
  const Icon = product.icon;
  const progress = getTaskProgress(product);

  return (
    <MarketingShell activeNav="roadmap">
      <div className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/roadmap"
            className="inline-flex items-center gap-1 text-sm text-ardoise/60 hover:text-encre"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("backToRoadmap")}
          </Link>

          <header className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-encre-muted">
                <Icon className="size-7 text-encre" aria-hidden />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-tight text-ardoise sm:text-3xl">
                    {productText(tp, product.key, "title")}
                  </h1>
                  <ProductStatusBadge status={product.status} />
                </div>
                <p className="mt-2 text-ardoise/60">{productText(tp, product.key, "tagline")}</p>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ardoise/50">
                  {productText(tp, product.key, "description")}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-ardoise/40">{t("progress")}</p>
              <p className="font-mono-data text-2xl font-semibold text-encre">{progress}%</p>
            </div>
          </header>

          {product.replaces.length > 0 && (
            <div className="mt-6 rounded-lg border border-canal bg-neutral-50/50 px-4 py-3">
              <p className="text-xs font-medium text-ardoise/50">{t("productDetail.replaces")}</p>
              <p className="mt-1 text-sm text-ardoise/70">{product.replaces.join(" · ")}</p>
            </div>
          )}

          {product.relatedSlugs && product.relatedSlugs.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-ardoise/50">{t("productDetail.related")}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {product.relatedSlugs.map((relatedSlug) => (
                  <li key={relatedSlug}>
                    <Link
                      href={`/roadmap/${relatedSlug}`}
                      className="rounded-full border border-canal bg-white px-3 py-1 text-xs text-ardoise/70 hover:border-encre/30 hover:text-encre"
                    >
                      {productText(tp, relatedSlug, "title")}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <section className="mt-12">
            <h2 className="text-lg font-medium text-ardoise">{t("productDetail.phases")}</h2>
            <ol className="mt-4 space-y-3">
              {product.phases.map((phase) => (
                <li
                  key={phase.id}
                  className="rounded-lg border border-canal bg-white px-4 py-3"
                >
                  <p className="font-medium text-ardoise">
                    {productText(tp, product.key, `phases.${phase.id}.title`)}
                  </p>
                  <p className="mt-1 text-sm text-ardoise/60">
                    {productText(tp, product.key, `phases.${phase.id}.goal`)}
                  </p>
                  <p className="mt-2 text-xs text-ardoise/40">
                    {t("tasks", { count: phase.tasks.length })}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-12">
            <h2 className="text-lg font-medium text-ardoise">{t("productDetail.gantt")}</h2>
            <div className="mt-4">
              <RoadmapGantt slug={slug} />
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-lg font-medium text-ardoise">{t("productDetail.taskList")}</h2>
            <div className="mt-4">
              <RoadmapTaskTable slug={slug} />
            </div>
          </section>

          <nav className="mt-16 flex items-center justify-between border-t border-canal pt-8">
            {prev ? (
              <Link
                href={`/roadmap/${prev.slug}`}
                className="inline-flex items-center gap-2 text-sm text-ardoise/70 hover:text-encre"
              >
                <ArrowLeft className="size-4" aria-hidden />
                <span>
                  <span className="block text-xs text-ardoise/40">{t("productDetail.prev")}</span>
                  {productText(tp, prev.key, "title")}
                </span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={`/roadmap/${next.slug}`}
                className="inline-flex items-center gap-2 text-right text-sm text-ardoise/70 hover:text-encre"
              >
                <span>
                  <span className="block text-xs text-ardoise/40">{t("productDetail.next")}</span>
                  {productText(tp, next.key, "title")}
                </span>
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </div>
      </div>
    </MarketingShell>
  );
}
