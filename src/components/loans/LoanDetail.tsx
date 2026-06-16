import { VisibilityBadge } from "@/components/ui/VisibilityBadge";
import { convertAmount, formatCurrency } from "@/lib/currency.server";
import { liveLoanState } from "@/lib/loan-interest";
import { borrowerName, isExternalParty, lenderName } from "@/lib/loan-party";
import type { FamilyMember, Loan, Repayment } from "@/types";
import { RepaymentForm } from "./RepaymentForm";

interface Props {
  loan: Loan;
  repayments: Repayment[];
  memberMap: Record<string, FamilyMember>;
  baseCurrency: string;
  rates: Record<string, number>;
  canAct: boolean;
}

export function LoanDetail({ loan, repayments, memberMap, baseCurrency, rates, canAct }: Props) {
  const lender = lenderName(loan, memberMap);
  const borrower = borrowerName(loan, memberMap);
  const { principalOutstanding, accruedInterest, totalOwed } = liveLoanState(loan);
  const principalRepaid = loan.principalAmount - principalOutstanding;
  const progressPct = (principalRepaid / loan.principalAmount) * 100;
  const hasInterest = loan.compoundingPeriod !== "none" && (loan.interestRate ?? 0) > 0;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-card rounded-xl border border-line p-6 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold text-foreground">{loan.description}</h1>
          <VisibilityBadge visibility={loan.visibility} />
        </div>

        <div className="flex gap-8 text-sm flex-wrap">
          <div>
            <p className="text-muted">Lender</p>
            <p className="font-medium">
              {lender}
              {isExternalParty(loan.lenderId) && (
                <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted/70">
                  external
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-muted">Borrower</p>
            <p className="font-medium">
              {borrower}
              {isExternalParty(loan.borrowerId) && (
                <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted/70">
                  external
                </span>
              )}
            </p>
          </div>
          {loan.dueDate && (
            <div>
              <p className="text-muted">Due date</p>
              <p className="font-medium">{loan.dueDate.toLocaleDateString()}</p>
            </div>
          )}
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted">Principal repaid</span>
            <span className="font-medium">
              {formatCurrency(principalRepaid, loan.currency)} of{" "}
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
              <dt className="text-muted">Principal outstanding</dt>
              <dd className="font-medium tabular-nums">
                {formatCurrency(principalOutstanding, loan.currency)}
              </dd>
            </div>
            <div className="flex justify-between col-span-2 sm:col-span-1">
              <dt className="text-muted">
                Accrued interest
                <span className="ml-1 text-xs text-muted/70">
                  ({loan.interestRate}% {loan.compoundingPeriod})
                </span>
              </dt>
              <dd className="font-medium tabular-nums text-amber-600 dark:text-amber-400">
                {formatCurrency(accruedInterest, loan.currency)}
              </dd>
            </div>
          </dl>
        )}

        <p className="text-sm text-muted">
          {hasInterest ? "Total owed" : "Remaining"}:{" "}
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
      </div>

      {canAct && loan.status !== "settled" && (
        <RepaymentForm loanId={loan.id} loanCurrency={loan.currency} />
      )}

      {repayments.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-medium text-foreground">Repayment history</h2>
          {repayments.map((r) => (
            <div
              key={r.id}
              className="bg-card rounded-lg border border-line p-3 flex justify-between items-center"
            >
              <div>
                <p className="text-sm font-medium">{formatCurrency(r.amount, r.currency)}</p>
                {r.interestPortion > 0.005 && (
                  <p className="text-xs text-muted">
                    {formatCurrency(r.principalPortion, loan.currency)} principal ·{" "}
                    {formatCurrency(r.interestPortion, loan.currency)} interest
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
