import { convertAmount, formatCurrency } from "@/lib/currency.server";
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
  const lender = memberMap[loan.lenderId];
  const borrower = memberMap[loan.borrowerId];
  const progressPct = ((loan.principalAmount - loan.remainingAmount) / loan.principalAmount) * 100;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">{loan.description}</h1>

        <div className="flex gap-8 text-sm flex-wrap">
          <div>
            <p className="text-gray-500">Lender</p>
            <p className="font-medium">{lender?.displayName ?? "Unknown"}</p>
          </div>
          <div>
            <p className="text-gray-500">Borrower</p>
            <p className="font-medium">{borrower?.displayName ?? "Unknown"}</p>
          </div>
          {loan.dueDate && (
            <div>
              <p className="text-gray-500">Due date</p>
              <p className="font-medium">{loan.dueDate.toLocaleDateString()}</p>
            </div>
          )}
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">Repaid</span>
            <span className="font-medium">
              {formatCurrency(loan.principalAmount - loan.remainingAmount, loan.currency)} of{" "}
              {formatCurrency(loan.principalAmount, loan.currency)}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Remaining:{" "}
            <span className="font-semibold text-gray-900">
              {formatCurrency(loan.remainingAmount, loan.currency)}
            </span>
            {loan.currency !== baseCurrency && (
              <span className="text-gray-400">
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
          <h2 className="font-medium text-gray-900">Repayment history</h2>
          {repayments.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-lg border border-gray-200 p-3 flex justify-between items-center"
            >
              <div>
                <p className="text-sm font-medium">{formatCurrency(r.amount, r.currency)}</p>
                {r.note && <p className="text-xs text-gray-500">{r.note}</p>}
                <p className="text-xs text-gray-400">{r.paidAt.toLocaleDateString()}</p>
              </div>
              {r.currency !== loan.currency && r.exchangeRateUsed && (
                <p className="text-xs text-gray-400">rate: {r.exchangeRateUsed.toFixed(4)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
