import { getPrisma } from "@/lib/prisma";
import { fetchScalewayObjectStoragePricing } from "@/lib/billing/scaleway-pricing";
import type { PlatformPricing } from "@prisma/client";

const PRICING_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const FALLBACK_EUR_PER_GB_MONTH = 0.01606;

type PlatformPricingDelegate = {
  findFirst: (args: {
    orderBy: { fetchedAt: "desc" };
  }) => Promise<PlatformPricing | null>;
  create: (args: {
    data: {
      sku: string;
      region: string;
      storageEurPerGbHour: number;
      storageEurPerGbMonth: number;
      source: string;
    };
  }) => Promise<PlatformPricing>;
};

function getPlatformPricingDelegate(): PlatformPricingDelegate | null {
  const client = getPrisma();
  const delegate = (client as unknown as Record<string, unknown>).platformPricing;

  if (
    typeof delegate !== "object" ||
    delegate === null ||
    typeof (delegate as { findFirst?: unknown }).findFirst !== "function" ||
    typeof (delegate as { create?: unknown }).create !== "function"
  ) {
    console.error(
      "Prisma platformPricing delegate unavailable — run `pnpm prisma:generate` and restart dev if needed"
    );
    return null;
  }

  return delegate as PlatformPricingDelegate;
}

function buildFallbackPricing(): PlatformPricing {
  const region = process.env.S3_REGION ?? "fr-par";
  return {
    id: "fallback",
    sku: `/storage/obj/usage-new-gen-bucket-standard/${region}`,
    region,
    storageEurPerGbHour: FALLBACK_EUR_PER_GB_MONTH / 730,
    storageEurPerGbMonth: FALLBACK_EUR_PER_GB_MONTH,
    source: "fallback_documented",
    fetchedAt: new Date(0),
  };
}

export async function getLatestPricing(): Promise<PlatformPricing | null> {
  const delegate = getPlatformPricingDelegate();
  if (!delegate) return null;

  try {
    return await delegate.findFirst({
      orderBy: { fetchedAt: "desc" },
    });
  } catch (error) {
    console.error("PlatformPricing lookup failed:", error);
    return null;
  }
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
): Promise<PlatformPricing | null> {
  const delegate = getPlatformPricingDelegate();
  if (!delegate) return buildFallbackPricing();

  return delegate.create({
    data: {
      sku: pricing.sku,
      region: pricing.region,
      storageEurPerGbHour: pricing.storageEurPerGbHour,
      storageEurPerGbMonth: pricing.storageEurPerGbMonth,
      source: "scaleway_public_catalog",
    },
  });
}

async function seedFallbackPricing(): Promise<PlatformPricing> {
  const delegate = getPlatformPricingDelegate();
  if (!delegate) return buildFallbackPricing();

  const region = process.env.S3_REGION ?? "fr-par";
  return delegate.create({
    data: {
      sku: `/storage/obj/usage-new-gen-bucket-standard/${region}`,
      region,
      storageEurPerGbHour: FALLBACK_EUR_PER_GB_MONTH / 730,
      storageEurPerGbMonth: FALLBACK_EUR_PER_GB_MONTH,
      source: "fallback_documented",
    },
  });
}

export async function syncPricingIfStale(): Promise<PlatformPricing | null> {
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
