"use client";

import { useActionState, useState } from "react";
import { createLoanAction, type LoanFormState } from "@/actions/loan.actions";
import { VisibilityField } from "@/components/ui/VisibilityField";
import type { FamilyMember } from "@/types";

const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "THB", "JPY", "SGD", "AUD", "CAD"];

type Direction = "lent" | "borrowed";
type CounterpartyType = "member" | "external";

interface Props {
  candidates: FamilyMember[];
  defaultCurrency: string;
}

export function LoanForm({ candidates, defaultCurrency }: Props) {
  const [state, formAction, pending] = useActionState<LoanFormState, FormData>(
    createLoanAction,
    null,
  );
  const [direction, setDirection] = useState<Direction>("lent");
  const [counterpartyType, setCounterpartyType] = useState<CounterpartyType>(
    candidates.length > 0 ? "member" : "external",
  );

  const counterpartyLabel = direction === "lent" ? "Borrower" : "Lender";

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="direction" value={direction} />
      <input type="hidden" name="counterpartyType" value={counterpartyType} />

      {/* Direction */}
      <div>
        <span className="block text-sm font-medium text-foreground/80 mb-1.5">Type</span>
        <div className="flex gap-1 bg-foreground/6 rounded-lg p-1">
          {(
            [
              ["lent", "I lent money"],
              ["borrowed", "I borrowed money"],
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
                ["member", "Family member"],
                ["external", "External"],
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
              Select a family member
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
            placeholder="e.g. John Smith, Bank of Example"
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
            Principal amount
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
            Currency
          </label>
          <select
            id="loan-currency"
            name="currency"
            defaultValue={defaultCurrency}
            className="w-full px-4 py-2 border border-line rounded-lg"
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
          <label
            htmlFor="loan-interest"
            className="block text-sm font-medium text-foreground/80 mb-1"
          >
            Interest rate % (optional)
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
          <label htmlFor="loan-due" className="block text-sm font-medium text-foreground/80 mb-1">
            Due date (optional)
          </label>
          <input
            id="loan-due"
            name="dueDate"
            type="date"
            className="w-full px-4 py-2 border border-line rounded-lg"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="loan-description"
          className="block text-sm font-medium text-foreground/80 mb-1"
        >
          Description
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
        {pending ? "Saving..." : "Create loan"}
      </button>
    </form>
  );
}
