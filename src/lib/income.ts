// Pure income helpers — safe on both server and client (no Firestore / no
// "server-only"). Mirrors the currency.ts / visibility.ts shared-logic convention.
import type { IncomeFrequency } from "@/types";

// Single source of truth for the frequency dropdown, in display order.
export const SUPPORTED_FREQUENCIES = [
  "monthly",
  "weekly",
  "quarterly",
  "yearly",
  "one_off",
] as const satisfies readonly IncomeFrequency[];

// Normalizes a per-occurrence amount to its monthly-equivalent value, so income
// of any cadence can be summed into one comparable "per month" figure. One-off
// income is not recurring, so it contributes 0 to the recurring total.
export function monthlyEquivalent(amount: number, frequency: IncomeFrequency): number {
  switch (frequency) {
    case "weekly":
      return (amount * 52) / 12;
    case "monthly":
      return amount;
    case "quarterly":
      return amount / 3;
    case "yearly":
      return amount / 12;
    case "one_off":
      return 0;
  }
}
