"use client";

import { useActionState, useState } from "react";
import { createLoanAction, type LoanFormState } from "@/actions/loan.actions";
import { useI18n } from "@/components/i18n/I18nProvider";
import { VisibilityField } from "@/components/ui/VisibilityField";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import type { FamilyMember } from "@/types";

type Direction = "lent" | "borrowed";
type CounterpartyType = "member" | "external";

interface Props {
  candidates: FamilyMember[];
  defaultCurrency: string;
}

export function LoanForm({ candidates, defaultCurrency }: Props) {
  const { dict } = useI18n();
  const [state, formAction, pending] = useActionState<LoanFormState, FormData>(
    createLoanAction,
    null,
  );
  const [direction, setDirection] = useState<Direction>("lent");
  const [counterpartyType, setCounterpartyType] = useState<CounterpartyType>(
    candidates.length > 0 ? "member" : "external",
  );

  const counterpartyLabel = direction === "lent" ? dict.loans.borrower : dict.loans.lender;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="direction" value={direction} />
      <input type="hidden" name="counterpartyType" value={counterpartyType} />

      {/* Direction */}
      <div>
        <span className="block text-sm font-medium text-foreground/80 mb-1.5">
          {dict.loans.type}
        </span>
        <div className="flex gap-1 bg-foreground/6 rounded-lg p-1">
          {(
            [
              ["lent", dict.loans.iLent],
              ["borrowed", dict.loans.iBorrowed],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setDirection(value)}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                direction === value
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted hover:text-foreground/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Counterparty: a family member or an external person/org */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-foreground/80">{counterpartyLabel}</span>
          <div className="flex gap-1 bg-foreground/6 rounded-lg p-0.5 text-xs">
            {(
              [
                ["member", dict.loans.familyMember],
                ["external", dict.loans.externalOption],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setCounterpartyType(value)}
                disabled={value === "member" && candidates.length === 0}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors disabled:opacity-40 ${
                  counterpartyType === value
                    ? "bg-card shadow-sm text-foreground"
                    : "text-muted hover:text-foreground/80"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {counterpartyType === "member" ? (
          <select
            id="loan-counterparty"
            name="counterpartyId"
            required
            defaultValue=""
            className="w-full px-4 py-2 border border-line rounded-lg"
          >
            <option value="" disabled>
              {dict.loans.selectMember}
            </option>
            {candidates.map((m) => (
              <option key={m.uid} value={m.uid}>
                {m.displayName}
              </option>
            ))}
          </select>
        ) : (
          <input
            id="loan-counterparty"
            name="counterpartyName"
            type="text"
            required
            maxLength={120}
            placeholder={dict.loans.externalNamePlaceholder}
            className="w-full px-4 py-2 border border-line rounded-lg"
          />
        )}
        {state?.errors?.counterpartyId && (
          <p className="text-sm text-red-500 mt-1">{state.errors.counterpartyId[0]}</p>
        )}
        {state?.errors?.counterpartyName && (
          <p className="text-sm text-red-500 mt-1">{state.errors.counterpartyName[0]}</p>
        )}
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
            required
            className="w-full px-4 py-2 border border-line rounded-lg"
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
            defaultValue={defaultCurrency}
            className="w-full px-4 py-2 border border-line rounded-lg"
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

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
            defaultValue="monthly"
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
          className="w-full px-4 py-2 border border-line rounded-lg"
        />
        {state?.errors?.description && (
          <p className="text-sm text-red-500 mt-1">{state.errors.description[0]}</p>
        )}
      </div>

      <VisibilityField defaultValue="shared" />

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2 px-4 bg-accent text-white rounded-lg hover:bg-accent-strong disabled:opacity-50"
      >
        {pending ? dict.common.saving : dict.loans.createLoan}
      </button>
    </form>
  );
}
