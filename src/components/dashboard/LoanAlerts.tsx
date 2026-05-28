import Link from "next/link";
import { formatCurrency } from "@/lib/currency.server";
import type { FamilyMember, Loan } from "@/types";

export function LoanAlerts({ loans, members }: { loans: Loan[]; members: FamilyMember[] }) {
  const memberMap = Object.fromEntries(members.map((m) => [m.uid, m]));

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
      <p className="text-sm font-semibold text-red-700">⚠️ Overdue loans</p>
      {loans.map((loan) => (
        <Link
          key={loan.id}
          href={`/loans/${loan.id}`}
          className="block text-sm text-red-600 hover:underline"
        >
          {memberMap[loan.lenderId]?.displayName ?? "Unknown"} →{" "}
          {memberMap[loan.borrowerId]?.displayName ?? "Unknown"}:{" "}
          {formatCurrency(loan.remainingAmount, loan.currency)} (due{" "}
          {loan.dueDate?.toLocaleDateString()})
        </Link>
      ))}
    </div>
  );
}
