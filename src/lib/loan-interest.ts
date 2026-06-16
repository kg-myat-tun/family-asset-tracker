import type { CompoundingPeriod, Loan } from "@/types";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_YEAR = 365;

function periodsPerYear(period: CompoundingPeriod): number {
  switch (period) {
    case "monthly":
      return 12;
    case "annually":
      return 1;
    default:
      return 0;
  }
}

/**
 * Compound interest accrued on `balance` between two dates, using an annual
 * rate (percent) compounded over fractional periods:
 *   balance × (1 + r/n)^((days/365)×n) − balance
 * Returns 0 when there is no rate, no compounding, or time runs backwards.
 */
export function accrue(
  balance: number,
  annualRatePct: number | null,
  period: CompoundingPeriod,
  from: Date,
  to: Date,
): number {
  const n = periodsPerYear(period);
  const rate = annualRatePct ?? 0;
  if (n === 0 || rate <= 0 || balance <= 0) return 0;

  const days = (to.getTime() - from.getTime()) / MS_PER_DAY;
  if (days <= 0) return 0;

  const periodsElapsed = (days / DAYS_PER_YEAR) * n;
  const factor = (1 + rate / 100 / n) ** periodsElapsed;
  return balance * factor - balance;
}

export interface LoanState {
  principalOutstanding: number;
  accruedInterest: number;
  totalOwed: number;
}

/**
 * Live balance of a loan as of `asOf`, accruing interest forward from the
 * loan's snapshot (taken at lastEventDate). O(1) — no ledger walk needed
 * because every repayment re-snapshots the balance.
 */
export function liveLoanState(loan: Loan, asOf: Date = new Date()): LoanState {
  const base = loan.principalOutstanding + loan.accruedInterestSnapshot;
  const interest = accrue(
    base,
    loan.interestRate,
    loan.compoundingPeriod,
    loan.lastEventDate,
    asOf,
  );
  const accruedInterest = loan.accruedInterestSnapshot + interest;
  return {
    principalOutstanding: loan.principalOutstanding,
    accruedInterest,
    totalOwed: loan.principalOutstanding + accruedInterest,
  };
}
