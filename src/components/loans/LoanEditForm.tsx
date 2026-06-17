"use client";

import { useActionState } from "react";
import type { LoanFormState } from "@/actions/loan.actions";
import { useI18n } from "@/components/i18n/I18nProvider";
import { VisibilityField } from "@/components/ui/VisibilityField";
import { borrowerName, lenderName } from "@/lib/loan-party";
import type { FamilyMember, Loan } from "@/types";

const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "THB", "JPY", "SGD", "AUD", "CAD"];

interface Props {
  action: (prevState: LoanFormState, formData: FormData) => Promise<LoanFormState>;
  loan: Loan;
  memberMap: Record<string, FamilyMember>;
  // Principal and currency are only editable before any repayment is recorded.
  editableAmount: boolean;
}

function toDateInput(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().split("T")[0];
}

export function LoanEditForm({ action, loan, memberMap, editableAmount }: Props) {
  const { dict } = useI18n();
  const [state, formAction, pending] = useActionState<LoanFormState, FormData>(action, null);

  return (
    <form action={formAction} className="space-y-5">
      {/* Parties are fixed once a loan exists — delete and recreate to change them. */}
      <div className="flex gap-8 text-sm">
        <div>
          <span className="block text-muted">{dict.loans.lender}</span>
          <span className="font-medium">{lenderName(loan, memberMap)}</span>
        </div>
        <div>
          <span className="block text-muted">{dict.loans.borrower}</span>
          <span className="font-medium">{borrowerName(loan, memberMap)}</span>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label
            htmlFor="loan-principal"
            className="block text-sm font-medium text-foreground/80 mb-1"
          >
            {dict.loans.principalAmount}
          </label>
          <input
            id="loan-principal"
            name="principalAmount"
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            defaultValue={loan.principalAmount}
            disabled={!editableAmount}
            className="w-full px-4 py-2 border border-line rounded-lg disabled:opacity-50"
          />
          {state?.errors?.principalAmount && (
            <p className="text-sm text-red-500 mt-1">{state.errors.principalAmount[0]}</p>
          )}
        </div>
        <div className="w-32">
          <label
            htmlFor="loan-currency"
            className="block text-sm font-medium text-foreground/80 mb-1"
          >
            {dict.loans.currency}
          </label>
          <select
            id="loan-currency"
            name="currency"
            defaultValue={loan.currency}
            disabled={!editableAmount}
            className="w-full px-4 py-2 border border-line rounded-lg disabled:opacity-50"
          >
            {[loan.currency, ...COMMON_CURRENCIES.filter((c) => c !== loan.currency)].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      {!editableAmount && (
        <p className="-mt-3 text-xs text-muted">{dict.loans.lockedNote}</p>
      )}

      <div className="flex gap-3">
        <div className="flex-1">
          <label
            htmlFor="loan-interest"
            className="block text-sm font-medium text-foreground/80 mb-1"
          >
            {dict.loans.interestRate}
          </label>
          <input
            id="loan-interest"
            name="interestRate"
            type="number"
            step="0.01"
            min="0"
            max="100"
            inputMode="decimal"
            defaultValue={loan.interestRate ?? ""}
            className="w-full px-4 py-2 border border-line rounded-lg"
          />
        </div>
        <div className="flex-1">
          <label
            htmlFor="loan-compounding"
            className="block text-sm font-medium text-foreground/80 mb-1"
          >
            {dict.loans.compounds}
          </label>
          <select
            id="loan-compounding"
            name="compoundingPeriod"
            defaultValue={loan.compoundingPeriod}
            className="w-full px-4 py-2 border border-line rounded-lg"
          >
            <option value="none">{dict.loans.compNone}</option>
            <option value="monthly">{dict.loans.compMonthly}</option>
            <option value="annually">{dict.loans.compAnnually}</option>
          </select>
        </div>
      </div>

      {/* Optional monthly repayment plan. Leave blank for a single due date. */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label
            htmlFor="loan-installments"
            className="block text-sm font-medium text-foreground/80 mb-1"
          >
            {dict.loans.installments}
          </label>
          <input
            id="loan-installments"
            name="installmentCount"
            type="number"
            step="1"
            min="1"
            max="600"
            inputMode="numeric"
            placeholder="12"
            defaultValue={loan.installmentCount ?? ""}
            className="w-full px-4 py-2 border border-line rounded-lg"
          />
        </div>
        <div className="flex-1">
          <label
            htmlFor="loan-first-payment"
            className="block text-sm font-medium text-foreground/80 mb-1"
          >
            {dict.loans.firstPaymentDate}
          </label>
          <input
            id="loan-first-payment"
            name="firstPaymentDate"
            type="date"
            defaultValue={toDateInput(loan.firstPaymentDate)}
            className="w-full px-4 py-2 border border-line rounded-lg"
          />
        </div>
      </div>

      <div>
        <label htmlFor="loan-due" className="block text-sm font-medium text-foreground/80 mb-1">
          {dict.loans.dueDateOnly}
        </label>
        <input
          id="loan-due"
          name="dueDate"
          type="date"
          defaultValue={toDateInput(loan.dueDate)}
          className="w-full px-4 py-2 border border-line rounded-lg"
        />
      </div>

      <div>
        <label
          htmlFor="loan-description"
          className="block text-sm font-medium text-foreground/80 mb-1"
        >
          {dict.loans.description}
        </label>
        <textarea
          id="loan-description"
          name="description"
          rows={3}
          required
          defaultValue={loan.description}
          className="w-full px-4 py-2 border border-line rounded-lg"
        />
        {state?.errors?.description && (
          <p className="text-sm text-red-500 mt-1">{state.errors.description[0]}</p>
        )}
      </div>

      <VisibilityField defaultValue={loan.visibility} />

      {state?.errors?._ && <p className="text-sm text-red-500">{state.errors._[0]}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2 px-4 bg-accent text-white rounded-lg hover:bg-accent-strong disabled:opacity-50"
      >
        {pending ? dict.common.saving : dict.common.saveChanges}
      </button>
    </form>
  );
}
