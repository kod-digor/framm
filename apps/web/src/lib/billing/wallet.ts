import { WalletTransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  groupUsageSnapshotsByMonth,
  getCurrentMonthKey,
} from "@/lib/usage/snapshots";
import { getLatestPricing, syncPricingIfStale } from "@/lib/billing/pricing";

export const INITIAL_DEPOSIT_EUR = 10;
export const CARD_FEE_PERCENT = 0.015;
export const CARD_FEE_FIXED_EUR = 0.25;

export function eurToCents(eur: number): number {
  return Math.round(eur * 100);
}

export function centsToEur(cents: number): number {
  return cents / 100;
}

/** Card processing fee on a gross charge (1.5% + 0.25 EUR fixed). */
export function computeCardFee(amountEur: number): { feeEur: number; netEur: number } {
  const feeEur = amountEur * CARD_FEE_PERCENT + CARD_FEE_FIXED_EUR;
  const netEur = amountEur - feeEur;
  return { feeEur, netEur };
}

export function computeInitialDeposit(): {
  grossEur: number;
  feeEur: number;
  netEur: number;
} {
  const grossEur = INITIAL_DEPOSIT_EUR;
  const { feeEur, netEur } = computeCardFee(grossEur);
  return { grossEur, feeEur, netEur };
}

export function computeRechargeAmount(avgMonthlyConsumptionEur: number): {
  grossEur: number;
  feeEur: number;
  netEur: number;
} {
  const grossEur =
    avgMonthlyConsumptionEur > INITIAL_DEPOSIT_EUR
      ? avgMonthlyConsumptionEur
      : INITIAL_DEPOSIT_EUR;
  const { feeEur, netEur } = computeCardFee(grossEur);
  return { grossEur, feeEur, netEur };
}

export type WalletSummary = {
  balanceCents: number;
  balanceEur: number;
  avgMonthlyConsumptionEur: number;
  nextRecharge: ReturnType<typeof computeRechargeAmount>;
  initialDeposit: ReturnType<typeof computeInitialDeposit>;
};

export async function getWalletSummary(orgId: string): Promise<WalletSummary> {
  const [org, consumptionTxs] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { walletBalanceCents: true },
    }),
    prisma.walletTransaction.findMany({
      where: { organizationId: orgId, type: WalletTransactionType.CONSUMPTION },
      select: { amountCents: true },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  const avgMonthlyConsumptionEur =
    consumptionTxs.length > 0
      ? consumptionTxs.reduce((sum, tx) => sum + tx.amountCents, 0) /
        consumptionTxs.length /
        100
      : 0;

  return {
    balanceCents: org.walletBalanceCents,
    balanceEur: centsToEur(org.walletBalanceCents),
    avgMonthlyConsumptionEur,
    nextRecharge: computeRechargeAmount(avgMonthlyConsumptionEur),
    initialDeposit: computeInitialDeposit(),
  };
}

export async function creditInitialDeposit(orgId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.walletTransaction.findFirst({
      where: { organizationId: orgId, type: WalletTransactionType.DEPOSIT },
    });
    if (existing) return;

    const { grossEur, feeEur, netEur } = computeInitialDeposit();
    const netCents = eurToCents(netEur);
    const feeCents = eurToCents(feeEur);
    const grossCents = eurToCents(grossEur);

    const org = await tx.organization.update({
      where: { id: orgId },
      data: { walletBalanceCents: { increment: netCents } },
      select: { walletBalanceCents: true },
    });

    await tx.walletTransaction.create({
      data: {
        organizationId: orgId,
        type: WalletTransactionType.DEPOSIT,
        amountCents: grossCents,
        feeCents,
        balanceAfterCents: org.walletBalanceCents,
        description: "Frais d'inscription — solde initial",
      },
    });
  });
}

export async function deductMonthlyConsumption(
  orgId: string,
  monthKey: string,
  storageCostEur: number
): Promise<boolean> {
  if (storageCostEur <= 0) return false;

  const existing = await prisma.walletTransaction.findFirst({
    where: {
      organizationId: orgId,
      type: WalletTransactionType.CONSUMPTION,
      monthKey,
    },
  });
  if (existing) return false;

  const costCents = eurToCents(storageCostEur);

  await prisma.$transaction(async (tx) => {
    const org = await tx.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { walletBalanceCents: true },
    });

    const newBalance = org.walletBalanceCents - costCents;

    await tx.organization.update({
      where: { id: orgId },
      data: { walletBalanceCents: newBalance },
    });

    await tx.walletTransaction.create({
      data: {
        organizationId: orgId,
        type: WalletTransactionType.CONSUMPTION,
        amountCents: costCents,
        feeCents: 0,
        balanceAfterCents: newBalance,
        monthKey,
        description: `Consommation mensuelle ${monthKey}`,
      },
    });
  });

  return true;
}

export async function processMonthlyWalletDeductions(): Promise<number> {
  const latestPricing = await getLatestPricing();
  const pricing = latestPricing ?? (await syncPricingIfStale());
  if (!pricing) return 0;

  const currentMonthKey = getCurrentMonthKey();
  const orgs = await prisma.organization.findMany({
    where: { status: "APPROVED" },
    select: { id: true },
  });

  let processed = 0;

  for (const org of orgs) {
    const snapshots = await prisma.usageSnapshot.findMany({
      where: { organizationId: org.id },
      orderBy: { recordedAt: "desc" },
      take: 1095,
    });

    const history = groupUsageSnapshotsByMonth(snapshots);

    for (const row of history) {
      if (row.monthKey >= currentMonthKey) continue;

      const storageGb = Number(row.storageBytes) / 1_073_741_824;
      const storageCostEur = storageGb * pricing.storageEurPerGbMonth;

      const deducted = await deductMonthlyConsumption(
        org.id,
        row.monthKey,
        storageCostEur
      );
      if (deducted) processed++;
    }
  }

  return processed;
}
