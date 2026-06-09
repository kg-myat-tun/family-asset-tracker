import { VisibilityBadge } from "@/components/ui/VisibilityBadge";
import { convertAmount, formatCurrency } from "@/lib/currency.server";
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
  const progressPct = ((loan.principalAmount - loan.remainingAmount) / loan.principalAmount) * 100;

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
            <span className="text-muted">Repaid</span>
            <span className="font-medium">
              {formatCurrency(loan.principalAmount - loan.remainingAmount, loan.currency)} of{" "}
              {formatCurrency(loan.principalAmount, loan.currency)}
            </span>
          </div>
          <div className="w-full bg-foreground/6 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
          <p className="text-sm text-muted mt-1">
            Remaining:{" "}
            <span className="font-semibold text-foreground">
              {formatCurrency(loan.remainingAmount, loan.currency)}
            </span>
            {loan.currency !== baseCurrency && (
              <span className="text-muted">
                {" "}
                ≈{" "}
                {formatCurrency(
                  convertAmount(loan.remainingAmount, loan.currency, baseCurrency, rates),
                  baseCurrency,
                )}
              </span>
            )}
          </p>
        </div>
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
