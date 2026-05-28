import Link from "next/link";
import { convertAmount, formatCurrency } from "@/lib/currency.server";
import type { FamilyMember, Loan } from "@/types";

interface Props {
  loans: Loan[];
  memberMap: Record<string, FamilyMember>;
  currentUid: string;
  baseCurrency: string;
  rates: Record<string, number>;
  today: Date;
}

const STATUS_STYLES = {
  active: "bg-blue-50 text-blue-700",
  partially_paid: "bg-yellow-50 text-yellow-700",
  settled: "bg-green-50 text-green-700",
};

export function LoanList({ loans, memberMap, currentUid, baseCurrency, rates, today }: Props) {
  if (loans.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
        <p className="text-gray-400 text-4xl mb-3">🤝</p>
        <p className="text-gray-500">No loans yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {loans.map((loan) => {
        const isLender = loan.lenderId === currentUid;
        const otherUid = isLender ? loan.borrowerId : loan.lenderId;
        const other = memberMap[otherUid];
        const isOverdue = loan.dueDate && loan.dueDate < today && loan.status !== "settled";

        return (
          <Link key={loan.id} href={`/loans/${loan.id}`}>
            <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900 truncate">{loan.description}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[loan.status]}`}
                    >
                      {loan.status.replace("_", " ")}
                    </span>
                    {isOverdue && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">
                        overdue
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {isLender ? "You lent to" : "You owe"}{" "}
                    <span className="font-medium text-gray-700">
                      {other?.displayName ?? "Unknown"}
                    </span>
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(loan.remainingAmount, loan.currency)}
                  </p>
                  {loan.currency !== baseCurrency && (
                    <p className="text-xs text-gray-400">
                      ≈{" "}
                      {formatCurrency(
                        convertAmount(loan.remainingAmount, loan.currency, baseCurrency, rates),
                        baseCurrency,
                      )}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    of {formatCurrency(loan.principalAmount, loan.currency)}
                  </p>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
