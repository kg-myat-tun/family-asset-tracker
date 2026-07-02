"use client";

import { deleteTransactionAction } from "@/actions/transactions.actions";
import { useI18n } from "@/components/i18n/I18nProvider";

export function DeleteTransactionButton({
  transactionId,
  label,
}: {
  transactionId: string;
  label: string;
}) {
  const { dict } = useI18n();
  const action = deleteTransactionAction.bind(null, transactionId);

  return (
    <form action={action}>
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm(`${dict.transactions.deleteConfirm} ${label}?`)) e.preventDefault();
        }}
        className="text-sm text-red-500 hover:text-red-700"
      >
        {dict.transactions.delete}
      </button>
    </form>
  );
}
