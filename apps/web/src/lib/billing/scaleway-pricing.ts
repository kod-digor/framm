const CATALOG_URL = "https://api.scaleway.com/product-catalog/v2alpha1/public-catalog/products";
const HOURS_PER_MONTH = 730;
const DEFAULT_SKU_SUFFIX = "usage-new-gen-bucket-standard";

type CatalogProduct = {
  sku: string;
  product: string;
  variant: string;
  price?: {
    retail_price?: {
      units?: number;
      nanos?: number;
    };
  };
  unit_of_measure?: {
    unit?: string;
    size?: number;
  };
};

export type ScalewayStoragePricing = {
  sku: string;
  region: string;
  storageEurPerGbHour: number;
  storageEurPerGbMonth: number;
};

function retailPriceEur(product: CatalogProduct) {
  const retail = product.price?.retail_price;
  if (!retail) return null;
  return (retail.units ?? 0) + (retail.nanos ?? 0) / 1_000_000_000;
}

async function fetchCatalogPage(page: number) {
  const url = new URL(CATALOG_URL);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", "100");

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Scaleway catalog HTTP ${res.status}`);
  }

  return (await res.json()) as { products?: CatalogProduct[] };
}

export async function fetchScalewayObjectStoragePricing(
  region = process.env.S3_REGION ?? "fr-par"
): Promise<ScalewayStoragePricing> {
  const targetSku = `/storage/obj/${DEFAULT_SKU_SUFFIX}/${region}`;
  let page = 1;

  while (page <= 60) {
    const data = await fetchCatalogPage(page);
    const products = data.products ?? [];

    for (const product of products) {
      if (product.sku !== targetSku) continue;

      const hourly = retailPriceEur(product);
      if (hourly == null || hourly <= 0) {
        throw new Error(`Invalid retail price for ${targetSku}`);
      }

      return {
        sku: product.sku,
        region,
        storageEurPerGbHour: hourly,
        storageEurPerGbMonth: hourly * HOURS_PER_MONTH,
      };
    }

    if (products.length < 100) break;
    page += 1;
  }

  throw new Error(`Object storage pricing not found for region ${region}`);
}
