"use client";

import { deleteIncomeAction } from "@/actions/income.actions";
import { useI18n } from "@/components/i18n/I18nProvider";

export function DeleteIncomeButton({ incomeId, label }: { incomeId: string; label: string }) {
  const { dict } = useI18n();
  const action = deleteIncomeAction.bind(null, incomeId);

  return (
    <form action={action}>
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm(`${dict.income.deleteConfirm} ${label}?`)) e.preventDefault();
        }}
        className="text-sm text-red-500 hover:text-red-700"
      >
        {dict.income.delete}
      </button>
    </form>
  );
}
