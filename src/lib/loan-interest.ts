import { addMonths } from "date-fns";
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

export type InstallmentStatus = "paid" | "due" | "overdue" | "upcoming";

export interface Installment {
  number: number;
  dueDate: Date;
  payment: number;
  principal: number;
  interest: number;
  // Outstanding principal after this installment.
  balance: number;
  status: InstallmentStatus;
}

export function hasSchedule(loan: Loan): boolean {
  return !!loan.installmentCount && loan.installmentCount > 0 && !!loan.firstPaymentDate;
}

/**
 * Amortise the loan into equal monthly installments. Uses the standard EMI
 * formula when interest applies, or an equal-principal split when it doesn't.
 * Installment status is derived from how much principal has actually been
 * repaid (principalAmount − principalOutstanding) and today's date — so paying
 * ahead or behind the plan is reflected without storing per-installment state.
 */
export function buildSchedule(loan: Loan, asOf: Date = new Date()): Installment[] {
  if (!hasSchedule(loan) || !loan.firstPaymentDate || !loan.installmentCount) return [];

  const n = loan.installmentCount;
  const principal = loan.principalAmount;
  const monthlyRate =
    loan.compoundingPeriod === "none" || !loan.interestRate ? 0 : loan.interestRate / 100 / 12;

  const emi =
    monthlyRate === 0
      ? principal / n
      : (principal * monthlyRate * (1 + monthlyRate) ** n) / ((1 + monthlyRate) ** n - 1);

  const principalRepaid = loan.principalAmount - loan.principalOutstanding;
  const today = asOf.getTime();

  const rows: Installment[] = [];
  let balance = principal;
  let cumulativePrincipal = 0;
  let nextAssigned = false;

  for (let i = 1; i <= n; i++) {
    const interest = monthlyRate === 0 ? 0 : balance * monthlyRate;
    // Absorb rounding drift into the final installment so the balance lands on 0.
    const principalPart = i === n ? balance : emi - interest;
    balance = Math.max(0, balance - principalPart);
    cumulativePrincipal += principalPart;

    const dueDate = addMonths(loan.firstPaymentDate, i - 1);
    let status: InstallmentStatus;
    if (principalRepaid + 0.005 >= cumulativePrincipal) {
      status = "paid";
    } else if (dueDate.getTime() < today) {
      status = "overdue";
    } else if (!nextAssigned) {
      status = "due";
      nextAssigned = true;
    } else {
      status = "upcoming";
    }

    rows.push({
      number: i,
      dueDate,
      payment: principalPart + interest,
      principal: principalPart,
      interest,
      balance,
      status,
    });
  }

  return rows;
}

/**
 * The next installment a borrower still needs to cover: the first that is not
 * yet paid (overdue ones take priority). Null when the plan is fully paid.
 */
export function nextInstallment(loan: Loan, asOf: Date = new Date()): Installment | null {
  const schedule = buildSchedule(loan, asOf);
  return schedule.find((r) => r.status !== "paid") ?? null;
}
