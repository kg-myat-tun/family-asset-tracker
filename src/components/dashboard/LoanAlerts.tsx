import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import { liveLoanState } from "@/lib/loan-interest";
import { borrowerName, lenderName } from "@/lib/loan-party";
import type { FamilyMember, Loan } from "@/types";

export function LoanAlerts({
  loans,
  members,
  title,
}: {
  loans: Loan[];
  members: FamilyMember[];
  title: string;
}) {
  const memberMap = Object.fromEntries(members.map((m) => [m.uid, m]));

  return (
    <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-5 space-y-2.5">
      <p className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-500/15">
          <TriangleAlert className="w-4 h-4 text-red-600 dark:text-red-400" aria-hidden="true" />
        </span>
        {title}
      </p>
      {loans.map((loan) => (
        <Link
          key={loan.id}
          href={`/loans/${loan.id}`}
          className="block text-sm text-red-600 dark:text-red-400 hover:underline"
        >
          {lenderName(loan, memberMap)} → {borrowerName(loan, memberMap)}:{" "}
          {formatCurrency(liveLoanState(loan).totalOwed, loan.currency)} (due{" "}
          {loan.dueDate?.toLocaleDateString()})
        </Link>
      ))}
    </div>
  );
}
