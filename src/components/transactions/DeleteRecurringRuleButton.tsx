"use client";

import { deleteRecurringRuleAction } from "@/actions/recurring-rules.actions";
import { useI18n } from "@/components/i18n/I18nProvider";

export function DeleteRecurringRuleButton({ ruleId, label }: { ruleId: string; label: string }) {
  const { dict } = useI18n();
  const action = deleteRecurringRuleAction.bind(null, ruleId);

  return (
    <form action={action}>
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm(`${dict.transactions.recurring.deleteConfirm} ${label}?`))
            e.preventDefault();
        }}
        className="text-sm text-red-500 hover:text-red-700"
      >
        {dict.transactions.recurring.delete}
      </button>
    </form>
  );
}
