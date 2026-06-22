import Link from "next/link";
import { VisibilityBadge } from "@/components/ui/VisibilityBadge";
import { convertAmount, formatCurrency } from "@/lib/currency.server";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { buildSchedule, hasSchedule, liveLoanState, nextInstallment } from "@/lib/loan-interest";
import { borrowerName, isExternalParty, lenderName } from "@/lib/loan-party";
import type { CompoundingPeriod, FamilyMember, Loan, Repayment } from "@/types";
import { DeleteLoanButton } from "./DeleteLoanButton";
import { RepaymentForm } from "./RepaymentForm";

interface Props {
  loan: Loan;
  repayments: Repayment[];
  memberMap: Record<string, FamilyMember>;
  baseCurrency: string;
  rates: Record<string, number>;
  canAct: boolean;
  canMutate: boolean;
  dict: Dictionary;
}

export function LoanDetail({
  loan,
  repayments,
  memberMap,
  baseCurrency,
  rates,
  canAct,
  canMutate,
  dict,
}: Props) {
  const lender = lenderName(loan, memberMap);
  const borrower = borrowerName(loan, memberMap);
  const { principalOutstanding, accruedInterest, totalOwed } = liveLoanState(loan);
  const principalRepaid = loan.principalAmount - principalOutstanding;
  const progressPct = (principalRepaid / loan.principalAmount) * 100;
  const hasInterest = loan.compoundingPeriod !== "none" && (loan.interestRate ?? 0) > 0;
  const schedule = hasSchedule(loan) ? buildSchedule(loan) : [];
  const next = nextInstallment(loan);
  const compoundingLabels: Record<CompoundingPeriod, string> = {
    none: dict.loans.compNone,
    monthly: dict.loans.compMonthly,
    annually: dict.loans.compAnnually,
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-card rounded-xl border border-line p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-foreground">{loan.description}</h1>
            <VisibilityBadge visibility={loan.visibility} />
          </div>
          {canMutate && (
            <div className="flex items-center gap-3 shrink-0">
              <Link href={`/loans/${loan.id}/edit`} className="text-sm text-accent hover:underline">
                {dict.assets.edit}
              </Link>
              <DeleteLoanButton loanId={loan.id} label={loan.description} />
            </div>
          )}
        </div>

        <div className="flex gap-8 text-sm flex-wrap">
          <div>
            <p className="text-muted">{dict.loans.lender}</p>
            <p className="font-medium">
              {lender}
              {isExternalParty(loan.lenderId) && (
                <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted/70">
                  {dict.common.external}
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-muted">{dict.loans.borrower}</p>
            <p className="font-medium">
              {borrower}
              {isExternalParty(loan.borrowerId) && (
                <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted/70">
                  {dict.common.external}
                </span>
              )}
            </p>
          </div>
          {loan.dueDate && (
            <div>
              <p className="text-muted">{dict.loans.dueDate}</p>
              <p className="font-medium">{loan.dueDate.toLocaleDateString()}</p>
            </div>
          )}
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted">{dict.loans.principalRepaid}</span>
            <span className="font-medium">
              {formatCurrency(principalRepaid, loan.currency)} {dict.common.of}{" "}
              {formatCurrency(loan.principalAmount, loan.currency)}
            </span>
          </div>
          <div className="w-full bg-foreground/6 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
        </div>

        {hasInterest && (
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm border-t border-line pt-4">
            <div className="flex justify-between col-span-2 sm:col-span-1">
              <dt className="text-muted">{dict.loans.principalOutstanding}</dt>
              <dd className="font-medium tabular-nums">
                {formatCurrency(principalOutstanding, loan.currency)}
              </dd>
            </div>
            <div className="flex justify-between col-span-2 sm:col-span-1">
              <dt className="text-muted">
                {dict.loans.accruedInterest}
                <span className="ml-1 text-xs text-muted/70">
                  ({loan.interestRate}% {compoundingLabels[loan.compoundingPeriod]})
                </span>
              </dt>
              <dd className="font-medium tabular-nums text-amber-600 dark:text-amber-400">
                {formatCurrency(accruedInterest, loan.currency)}
              </dd>
            </div>
          </dl>
        )}

        <p className="text-sm text-muted">
          {hasInterest ? dict.loans.totalOwed : dict.loans.remaining}:{" "}
          <span className="font-semibold text-foreground">
            {formatCurrency(totalOwed, loan.currency)}
          </span>
          {loan.currency !== baseCurrency && (
            <span className="text-muted">
              {" "}
              ≈{" "}
              {formatCurrency(
                convertAmount(totalOwed, loan.currency, baseCurrency, rates),
                baseCurrency,
              )}
            </span>
          )}
        </p>

        {next && loan.status !== "settled" && (
          <p
            className={`text-sm border-t border-line pt-4 ${
              next.status === "overdue" ? "text-red-600 dark:text-red-400" : "text-muted"
            }`}
          >
            {next.status === "overdue" ? dict.loans.installmentOverdue : dict.loans.nextPayment}:{" "}
            <span className="font-semibold text-foreground">
              {formatCurrency(next.payment, loan.currency)}
            </span>{" "}
            {next.dueDate.toLocaleDateString()} · #{next.number} {dict.common.of}{" "}
            {loan.installmentCount}
          </p>
        )}
      </div>

      {canAct && loan.status !== "settled" && (
        <RepaymentForm loanId={loan.id} loanCurrency={loan.currency} />
      )}

      {schedule.length > 0 && (
        <details className="bg-card rounded-xl border border-line p-4">
          <summary className="text-sm font-medium text-foreground cursor-pointer">
            {dict.loans.repaymentSchedule} ({loan.installmentCount}{" "}
            {dict.loans.scheduleInstallments})
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-line">
                  <th className="py-1.5 pr-3 font-medium">{dict.loans.colNum}</th>
                  <th className="py-1.5 pr-3 font-medium">{dict.loans.colDue}</th>
                  <th className="py-1.5 pr-3 font-medium text-right">{dict.loans.colPayment}</th>
                  <th className="py-1.5 pr-3 font-medium text-right">{dict.loans.colPrincipal}</th>
                  <th className="py-1.5 pr-3 font-medium text-right">{dict.loans.colInterest}</th>
                  <th className="py-1.5 font-medium text-right">{dict.loans.colBalance}</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((row) => (
                  <tr
                    key={row.number}
                    className={`border-b border-line/60 last:border-0 ${
                      row.status === "paid"
                        ? "text-muted line-through"
                        : row.status === "overdue"
                          ? "text-red-600 dark:text-red-400"
                          : "text-foreground"
                    }`}
                  >
                    <td className="py-1.5 pr-3 tabular-nums">{row.number}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{row.dueDate.toLocaleDateString()}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {formatCurrency(row.payment, loan.currency)}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {formatCurrency(row.principal, loan.currency)}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {formatCurrency(row.interest, loan.currency)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatCurrency(row.balance, loan.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {repayments.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-medium text-foreground">{dict.loans.repaymentHistory}</h2>
          {repayments.map((r) => (
            <div
              key={r.id}
              className="bg-card rounded-lg border border-line p-3 flex justify-between items-center"
            >
              <div>
                <p className="text-sm font-medium">{formatCurrency(r.amount, r.currency)}</p>
                {r.interestPortion > 0.005 && (
                  <p className="text-xs text-muted">
                    {formatCurrency(r.principalPortion, loan.currency)} {dict.loans.principal} ·{" "}
                    {formatCurrency(r.interestPortion, loan.currency)} {dict.loans.interest}
                  </p>
                )}
                {r.note && <p className="text-xs text-muted">{r.note}</p>}
                <p className="text-xs text-muted">{r.paidAt.toLocaleDateString()}</p>
              </div>
              {r.currency !== loan.currency && r.exchangeRateUsed && (
                <p className="text-xs text-muted">rate: {r.exchangeRateUsed.toFixed(4)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
