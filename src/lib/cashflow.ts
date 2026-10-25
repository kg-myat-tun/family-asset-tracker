// Pure cash-flow helpers — safe on both server and client (no Firestore / no
// "server-only"). Mirrors the currency.ts / visibility.ts shared-logic convention.
import type { ExpenseCategory, IncomeCategory, RecurringFrequency } from "@/types";

export const SUPPORTED_INCOME_CATEGORIES = [
  "salary",
  "bonus",
  "gift",
  "investment",
  "other",
] as const satisfies readonly IncomeCategory[];

export const SUPPORTED_EXPENSE_CATEGORIES = [
  "housing",
  "groceries",
  "utilities",
  "transport",
  "healthcare",
  "entertainment",
  "debt",
  "other",
] as const satisfies readonly ExpenseCategory[];

export const SUPPORTED_RECURRING_FREQUENCIES = [
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
] as const satisfies readonly RecurringFrequency[];

// Normalizes a recurring rule's per-occurrence amount to its monthly-equivalent
// value, for display before it has ever been posted as an actual transaction.
export function monthlyEquivalent(amount: number, frequency: RecurringFrequency): number {
  switch (frequency) {
    case "weekly":
      return (amount * 52) / 12;
    case "monthly":
      return amount;
    case "quarterly":
      return amount / 3;
    case "yearly":
      return amount / 12;
  }
}

// Advances a due date to its next occurrence for a given cadence. Used by the
// recurring-transactions cron to move a rule's nextDueDate forward after
// posting. Works in UTC to match this repo's existing day-boundary convention
// (see the fx-rates/reminders crons' toISOString().split("T")[0] usage).
// Month-based cadences land on `anchorDay`, clamped to the target month's
// length, so a rule anchored on the 31st goes Jan 31 -> Feb 28 -> Mar 31
// instead of rolling over into March or drifting to the 28th.
export function nextDueDateAfter(
  date: Date,
  frequency: RecurringFrequency,
  anchorDay = date.getUTCDate(),
): Date {
  switch (frequency) {
    case "weekly": {
      const next = new Date(date);
      next.setUTCDate(next.getUTCDate() + 7);
      return next;
    }
    case "monthly":
      return addUTCMonthsClamped(date, 1, anchorDay);
    case "quarterly":
      return addUTCMonthsClamped(date, 3, anchorDay);
    case "yearly":
      return addUTCMonthsClamped(date, 12, anchorDay);
  }
}

function addUTCMonthsClamped(date: Date, months: number, anchorDay: number): Date {
  const next = new Date(date);
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const daysInMonth = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
  ).getUTCDate();
  next.setUTCDate(Math.min(anchorDay, daysInMonth));
  return next;
}
