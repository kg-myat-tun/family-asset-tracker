"use client";

import { useActionState, useState } from "react";
import type { IncomeFormState } from "@/actions/income.actions";
import { useI18n } from "@/components/i18n/I18nProvider";
import { VisibilityField } from "@/components/ui/VisibilityField";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { SUPPORTED_FREQUENCIES } from "@/lib/income";
import type { Income, IncomeFrequency } from "@/types";

interface Props {
  action: (prevState: IncomeFormState, formData: FormData) => Promise<IncomeFormState>;
  defaultValues?: Partial<Income>;
  submitLabel?: string;
}

// Renders a yyyy-mm-dd value for the native date input.
function toDateInput(date?: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export function IncomeForm({ action, defaultValues, submitLabel }: Props) {
  const { dict } = useI18n();
  const [state, formAction, pending] = useActionState<IncomeFormState, FormData>(action, null);
  const [frequency, setFrequency] = useState<IncomeFrequency>(
    defaultValues?.frequency ?? "monthly",
  );

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="income-name" className="block text-sm font-medium text-foreground/80 mb-1">
          {dict.income.name}
        </label>
        <input
          id="income-name"
          name="name"
          defaultValue={defaultValues?.name}
          required
          className="w-full px-4 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-soft"
        />
        {state?.errors?.name && <p className="text-sm text-red-500 mt-1">{state.errors.name[0]}</p>}
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label
            htmlFor="income-amount"
            className="block text-sm font-medium text-foreground/80 mb-1"
          >
            {dict.income.amount}
          </label>
          <input
            id="income-amount"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            defaultValue={defaultValues?.amount}
            required
            className="w-full px-4 py-2 border border-line rounded-lg"
          />
          {state?.errors?.amount && (
            <p className="text-sm text-red-500 mt-1">{state.errors.amount[0]}</p>
          )}
        </div>
        <div className="w-32">
          <label
            htmlFor="income-currency"
            className="block text-sm font-medium text-foreground/80 mb-1"
          >
            {dict.income.currency}
          </label>
          <select
            id="income-currency"
            name="currency"
            defaultValue={defaultValues?.currency ?? "USD"}
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

      <div>
        <label
          htmlFor="income-frequency"
          className="block text-sm font-medium text-foreground/80 mb-1"
        >
          {dict.income.frequency}
        </label>
        <select
          id="income-frequency"
          name="frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as IncomeFrequency)}
          className="w-full px-4 py-2 border border-line rounded-lg"
        >
          {SUPPORTED_FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {dict.income.frequencies[f]}
            </option>
          ))}
        </select>
      </div>

      {frequency === "one_off" && (
        <div>
          <label
            htmlFor="income-received"
            className="block text-sm font-medium text-foreground/80 mb-1"
          >
            {dict.income.receivedAt}
          </label>
          <input
            id="income-received"
            name="receivedAt"
            type="date"
            defaultValue={toDateInput(defaultValues?.receivedAt)}
            className="w-full px-4 py-2 border border-line rounded-lg"
          />
          {state?.errors?.receivedAt && (
            <p className="text-sm text-red-500 mt-1">{state.errors.receivedAt[0]}</p>
          )}
        </div>
      )}

      <div>
        <label
          htmlFor="income-description"
          className="block text-sm font-medium text-foreground/80 mb-1"
        >
          {dict.income.descriptionOptional}
        </label>
        <textarea
          id="income-description"
          name="description"
          defaultValue={defaultValues?.description}
          rows={3}
          className="w-full px-4 py-2 border border-line rounded-lg"
        />
      </div>

      <VisibilityField defaultValue={defaultValues?.visibility ?? "shared"} />

      {state?.errors?._ && <p className="text-sm text-red-500">{state.errors._[0]}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2 px-4 bg-accent text-white rounded-lg hover:bg-accent-strong disabled:opacity-50"
      >
        {pending ? dict.common.saving : (submitLabel ?? dict.income.createIncome)}
      </button>
    </form>
  );
}
