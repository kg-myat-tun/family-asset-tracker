"use client";

import { deleteLoanAction } from "@/actions/loan.actions";
import { useI18n } from "@/components/i18n/I18nProvider";

export function DeleteLoanButton({ loanId, label }: { loanId: string; label: string }) {
  const { dict } = useI18n();
  const action = deleteLoanAction.bind(null, loanId);

  return (
    <form action={action}>
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm(`${label} — ${dict.loans.deleteConfirm}`)) {
            e.preventDefault();
          }
        }}
        className="text-sm text-red-500 hover:text-red-700"
      >
        {dict.loans.delete}
      </button>
    </form>
  );
}
