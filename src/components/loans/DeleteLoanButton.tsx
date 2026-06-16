"use client";

import { deleteLoanAction } from "@/actions/loan.actions";

export function DeleteLoanButton({ loanId, label }: { loanId: string; label: string }) {
  const action = deleteLoanAction.bind(null, loanId);

  return (
    <form action={action}>
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm(`Delete loan "${label}"? This also removes its repayment history.`)) {
            e.preventDefault();
          }
        }}
        className="text-sm text-red-500 hover:text-red-700"
      >
        Delete
      </button>
    </form>
  );
}
