import { PRODUCT_CATEGORIES, PRODUCT_DEFINITIONS } from "@/lib/products-catalog";
import { getT } from "@/i18n/t";
import { ProductCard } from "./product-card";

export async function ProductShowcase() {
  const t = await getT("association");
  const tp = await getT("products");

  return (
    <section className="bg-encre-muted/30 px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-ardoise sm:text-3xl">
            {t("products.title")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ardoise/60">{t("products.subtitle")}</p>
        </div>

        {PRODUCT_CATEGORIES.map((category) => {
          const products = PRODUCT_DEFINITIONS.filter((p) => p.category === category);
          if (products.length === 0) return null;

          return (
            <div key={category} className="mt-12">
              <h3 className="text-sm font-medium tracking-wide text-encre uppercase">
                {tp(`categories.${category}`)}
              </h3>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => (
                  <li key={product.key}>
                    <ProductCard slug={product.slug} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
