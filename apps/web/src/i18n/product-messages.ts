import type { ProductKey } from "@/lib/products-catalog";

export function productText(
  t: (key: string) => string,
  productKey: ProductKey,
  suffix: string
): string {
  return t(`items.${productKey}.${suffix}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function asStringTranslator(t: any): (key: string) => string {
  return (key: string) => t(key);
}
