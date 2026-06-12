import { estimateStorageCostEur } from "@/lib/billing/pricing";
import {
  CARD_FEE_FIXED_EUR,
  CARD_FEE_PERCENT,
  computeCardFee,
} from "@/lib/billing/wallet";
import type { UsageHistoryRow } from "@/lib/usage/snapshots";

export type MonthlyInvoice = {
  storageEur: number;
  cardFeeEur: number;
  totalEur: number;
};

export function computeCardFeeEur(amountEur: number): number {
  return computeCardFee(amountEur).feeEur;
}

export function computeMonthlyInvoice(
  row: Pick<UsageHistoryRow, "storageBytes">,
  eurPerGbMonth: number
): MonthlyInvoice {
  const storageEur = estimateStorageCostEur(row.storageBytes, eurPerGbMonth);
  const cardFeeEur = storageEur * CARD_FEE_PERCENT + CARD_FEE_FIXED_EUR;
  const totalEur = storageEur + cardFeeEur;

  return { storageEur, cardFeeEur, totalEur };
}
