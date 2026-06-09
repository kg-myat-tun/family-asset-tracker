import Link from "next/link";
import { formatCurrency } from "@/lib/currency.server";
import { borrowerName, lenderName } from "@/lib/loan-party";
import type { FamilyMember, Loan } from "@/types";

export function LoanAlerts({ loans, members }: { loans: Loan[]; members: FamilyMember[] }) {
  const memberMap = Object.fromEntries(members.map((m) => [m.uid, m]));

  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-2.5 shadow-[0_18px_40px_-30px_rgba(220,38,38,0.5)]">
      <p className="text-sm font-semibold text-red-700 flex items-center gap-2">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-100">⚠️</span>
        Overdue loans
      </p>
      {loans.map((loan) => (
        <Link
          key={loan.id}
          href={`/loans/${loan.id}`}
          className="block text-sm text-red-600 hover:text-red-700 hover:underline"
        >
          {lenderName(loan, memberMap)} → {borrowerName(loan, memberMap)}:{" "}
          {formatCurrency(loan.remainingAmount, loan.currency)} (due{" "}
          {loan.dueDate?.toLocaleDateString()})
        </Link>
      ))}
    </div>
  );
}
