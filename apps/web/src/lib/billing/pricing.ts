import { prisma } from "@/lib/prisma";
import { fetchScalewayObjectStoragePricing } from "@/lib/billing/scaleway-pricing";

const PRICING_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const FALLBACK_EUR_PER_GB_MONTH = 0.01606;

export async function getLatestPricing() {
  return prisma.platformPricing.findFirst({
    orderBy: { fetchedAt: "desc" },
  });
}

export function estimateStorageCostEur(
  bytes: bigint,
  eurPerGbMonth: number
): number {
  const gb = Number(bytes) / 1_073_741_824;
  return gb * eurPerGbMonth;
}

export function formatEur(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

async function persistPricing(
  pricing: Awaited<ReturnType<typeof fetchScalewayObjectStoragePricing>>
) {
  return prisma.platformPricing.create({
    data: {
      sku: pricing.sku,
      region: pricing.region,
      storageEurPerGbHour: pricing.storageEurPerGbHour,
      storageEurPerGbMonth: pricing.storageEurPerGbMonth,
      source: "scaleway_public_catalog",
    },
  });
}

async function seedFallbackPricing() {
  const region = process.env.S3_REGION ?? "fr-par";
  return prisma.platformPricing.create({
    data: {
      sku: `/storage/obj/usage-new-gen-bucket-standard/${region}`,
      region,
      storageEurPerGbHour: FALLBACK_EUR_PER_GB_MONTH / 730,
      storageEurPerGbMonth: FALLBACK_EUR_PER_GB_MONTH,
      source: "fallback_documented",
    },
  });
}

export async function syncPricingIfStale() {
  const latest = await getLatestPricing();
  const stale =
    !latest || Date.now() - latest.fetchedAt.getTime() > PRICING_MAX_AGE_MS;

  if (!stale) return latest;

  try {
    const fetched = await fetchScalewayObjectStoragePricing();
    return persistPricing(fetched);
  } catch (error) {
    console.error("Scaleway pricing sync failed:", error);
    if (latest) return latest;
    return seedFallbackPricing();
  }
}
