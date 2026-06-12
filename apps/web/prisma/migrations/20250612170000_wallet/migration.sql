-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('DEPOSIT', 'CONSUMPTION', 'RECHARGE');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "walletBalanceCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "balanceAfterCents" INTEGER NOT NULL,
    "monthKey" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WalletTransaction_organizationId_createdAt_idx" ON "WalletTransaction"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_organizationId_monthKey_type_idx" ON "WalletTransaction"("organizationId", "monthKey", "type");

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
