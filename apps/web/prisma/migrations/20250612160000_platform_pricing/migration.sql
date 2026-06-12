-- CreateTable
CREATE TABLE "PlatformPricing" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "storageEurPerGbHour" DOUBLE PRECISION NOT NULL,
    "storageEurPerGbMonth" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformPricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformPricing_fetchedAt_idx" ON "PlatformPricing"("fetchedAt");

-- CreateIndex
CREATE INDEX "UsageSnapshot_organizationId_recordedAt_idx" ON "UsageSnapshot"("organizationId", "recordedAt");
