"use client";

import { useActionState } from "react";
import { type LoanFormState, recordRepaymentAction } from "@/actions/loan.actions";

const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "THB", "JPY", "SGD", "AUD", "CAD"];

export function RepaymentForm({ loanId, loanCurrency }: { loanId: string; loanCurrency: string }) {
  const action = recordRepaymentAction.bind(null, loanId);
  const [state, formAction, pending] = useActionState<LoanFormState, FormData>(action, null);

  return (
    <form action={formAction} className="space-y-4 bg-gray-50 rounded-xl p-4">
      <h3 className="font-medium text-gray-900">Record repayment</h3>

      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="repay-amount" className="block text-sm text-gray-600 mb-1">
            Amount paid
          </label>
          <input
            id="repay-amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          {state?.errors?.amount && (
            <p className="text-xs text-red-500 mt-1">{state.errors.amount[0]}</p>
          )}
        </div>
        <div className="w-28">
          <label htmlFor="repay-currency" className="block text-sm text-gray-600 mb-1">
            Currency
          </label>
          <select
            id="repay-currency"
            name="currency"
            defaultValue={loanCurrency}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
        <label htmlFor="repay-note" className="block text-sm text-gray-600 mb-1">
          Note (optional)
        </label>
        <input
          id="repay-note"
          name="note"
          placeholder="e.g. Cash payment"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      {state?.errors?._ && <p className="text-sm text-red-500">{state.errors._[0]}</p>}

      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
      >
        {pending ? "Recording..." : "Record payment"}
      </button>
    </form>
  );
}
