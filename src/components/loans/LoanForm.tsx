"use client";

import { useActionState } from "react";
import { createLoanAction, type LoanFormState } from "@/actions/loan.actions";
import type { FamilyMember } from "@/types";

const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "THB", "JPY", "SGD", "AUD", "CAD"];

interface Props {
  candidates: FamilyMember[];
  defaultCurrency: string;
}

export function LoanForm({ candidates, defaultCurrency }: Props) {
  const [state, formAction, pending] = useActionState<LoanFormState, FormData>(
    createLoanAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="loan-borrower" className="block text-sm font-medium text-gray-700 mb-1">
          Borrower
        </label>
        <select
          id="loan-borrower"
          name="borrowerId"
          required
          defaultValue=""
          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
        >
          <option value="" disabled>
            Select a family member
          </option>
          {candidates.map((m) => (
            <option key={m.uid} value={m.uid}>
              {m.displayName}
            </option>
          ))}
        </select>
        {state?.errors?.borrowerId && (
          <p className="text-sm text-red-500 mt-1">{state.errors.borrowerId[0]}</p>
        )}
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="loan-principal" className="block text-sm font-medium text-gray-700 mb-1">
            Principal amount
          </label>
          <input
            id="loan-principal"
            name="principalAmount"
            type="number"
            step="0.01"
            min="0.01"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
          {state?.errors?.principalAmount && (
            <p className="text-sm text-red-500 mt-1">{state.errors.principalAmount[0]}</p>
          )}
        </div>
        <div className="w-32">
          <label htmlFor="loan-currency" className="block text-sm font-medium text-gray-700 mb-1">
            Currency
          </label>
          <select
            id="loan-currency"
            name="currency"
            defaultValue={defaultCurrency}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          >
            {COMMON_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="loan-interest" className="block text-sm font-medium text-gray-700 mb-1">
            Interest rate % (optional)
          </label>
          <input
            id="loan-interest"
            name="interestRate"
            type="number"
            step="0.01"
            min="0"
            max="100"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="loan-due" className="block text-sm font-medium text-gray-700 mb-1">
            Due date (optional)
          </label>
          <input
            id="loan-due"
            name="dueDate"
            type="date"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      <div>
        <label htmlFor="loan-description" className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          id="loan-description"
          name="description"
          rows={3}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
        />
        {state?.errors?.description && (
          <p className="text-sm text-red-500 mt-1">{state.errors.description[0]}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Saving..." : "Create loan"}
      </button>
    </form>
  );
}
