"use client";

import { useActionState } from "react";
import { type LoanFormState, recordRepaymentAction } from "@/actions/loan.actions";
import { useI18n } from "@/components/i18n/I18nProvider";

const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "THB", "JPY", "SGD", "AUD", "CAD"];

export function RepaymentForm({ loanId, loanCurrency }: { loanId: string; loanCurrency: string }) {
  const { dict } = useI18n();
  const action = recordRepaymentAction.bind(null, loanId);
  const [state, formAction, pending] = useActionState<LoanFormState, FormData>(action, null);

  return (
    <form action={formAction} className="space-y-4 bg-background rounded-xl p-4">
      <h3 className="font-medium text-foreground">{dict.loans.recordRepayment}</h3>

      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="repay-amount" className="block text-sm text-muted mb-1">
            {dict.loans.amountPaid}
          </label>
          <input
            id="repay-amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            required
            className="w-full px-3 py-2 border border-line rounded-lg text-sm"
          />
          {state?.errors?.amount && (
            <p className="text-xs text-red-500 mt-1">{state.errors.amount[0]}</p>
          )}
        </div>
        <div className="w-28">
          <label htmlFor="repay-currency" className="block text-sm text-muted mb-1">
            {dict.loans.currency}
          </label>
          <select
            id="repay-currency"
            name="currency"
            defaultValue={loanCurrency}
            className="w-full px-3 py-2 border border-line rounded-lg text-sm"
          >
            {COMMON_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="repay-note" className="block text-sm text-muted mb-1">
          {dict.loans.noteOptional}
        </label>
        <input
          id="repay-note"
          name="note"
          placeholder={dict.loans.notePlaceholder}
          className="w-full px-3 py-2 border border-line rounded-lg text-sm"
        />
      </div>

      {state?.errors?._ && <p className="text-sm text-red-500">{state.errors._[0]}</p>}

      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
      >
        {pending ? dict.loans.recording : dict.loans.recordPayment}
      </button>
    </form>
  );
}
