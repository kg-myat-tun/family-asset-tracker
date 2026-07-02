"use client";

import { useActionState, useState } from "react";
import type { RecurringRuleFormState } from "@/actions/recurring-rules.actions";
import { useI18n } from "@/components/i18n/I18nProvider";
import { VisibilityField } from "@/components/ui/VisibilityField";
import {
  SUPPORTED_EXPENSE_CATEGORIES,
  SUPPORTED_INCOME_CATEGORIES,
  SUPPORTED_RECURRING_FREQUENCIES,
} from "@/lib/cashflow";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import type { ExpenseCategory, IncomeCategory, RecurringRule, TransactionType } from "@/types";

interface Props {
  action: (
    prevState: RecurringRuleFormState,
    formData: FormData,
  ) => Promise<RecurringRuleFormState>;
  defaultValues?: Partial<RecurringRule>;
  submitLabel?: string;
}

export function RecurringRuleForm({ action, defaultValues, submitLabel }: Props) {
  const { dict } = useI18n();
  const [state, formAction, pending] = useActionState<RecurringRuleFormState, FormData>(
    action,
    null,
  );
  const [type, setType] = useState<TransactionType>(defaultValues?.type ?? "expense");
  const [category, setCategory] = useState<IncomeCategory | ExpenseCategory>(
    defaultValues?.category ?? (type === "income" ? "salary" : "housing"),
  );
  const categories = type === "income" ? SUPPORTED_INCOME_CATEGORIES : SUPPORTED_EXPENSE_CATEGORIES;

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <span className="block text-sm font-medium text-foreground/80 mb-1.5">
          {dict.transactions.type}
        </span>
        <input type="hidden" name="type" value={type} />
        <div className="flex gap-1 bg-foreground/6 rounded-lg p-1">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setType(t);
                const list =
                  t === "income" ? SUPPORTED_INCOME_CATEGORIES : SUPPORTED_EXPENSE_CATEGORIES;
                setCategory(list[0]);
              }}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                type === t
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted hover:text-foreground/80"
              }`}
            >
              {t === "income" ? dict.transactions.typeIncome : dict.transactions.typeExpense}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="rule-name" className="block text-sm font-medium text-foreground/80 mb-1">
          {dict.transactions.name}
        </label>
        <input
          id="rule-name"
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
            htmlFor="rule-amount"
            className="block text-sm font-medium text-foreground/80 mb-1"
          >
            {dict.transactions.amount}
          </label>
          <input
            id="rule-amount"
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
            htmlFor="rule-currency"
            className="block text-sm font-medium text-foreground/80 mb-1"
          >
            {dict.transactions.currency}
          </label>
          <select
            id="rule-currency"
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
          htmlFor="rule-frequency"
          className="block text-sm font-medium text-foreground/80 mb-1"
        >
          {dict.transactions.recurring.frequency}
        </label>
        <select
          id="rule-frequency"
          name="frequency"
          defaultValue={defaultValues?.frequency ?? "monthly"}
          className="w-full px-4 py-2 border border-line rounded-lg"
        >
          {SUPPORTED_RECURRING_FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {dict.transactions.recurring.frequencies[f]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="rule-category"
          className="block text-sm font-medium text-foreground/80 mb-1"
        >
          {dict.transactions.category}
        </label>
        <select
          id="rule-category"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as IncomeCategory | ExpenseCategory)}
          className="w-full px-4 py-2 border border-line rounded-lg"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {dict.transactions.categories[c]}
            </option>
          ))}
        </select>
        {state?.errors?.category && (
          <p className="text-sm text-red-500 mt-1">{state.errors.category[0]}</p>
        )}
      </div>

      {category === "other" && (
        <div>
          <label
            htmlFor="rule-custom-label"
            className="block text-sm font-medium text-foreground/80 mb-1"
          >
            {dict.transactions.customLabel}
          </label>
          <input
            id="rule-custom-label"
            name="customLabel"
            defaultValue={defaultValues?.customLabel ?? ""}
            placeholder={dict.transactions.customLabelPlaceholder}
            className="w-full px-4 py-2 border border-line rounded-lg"
          />
          {state?.errors?.customLabel && (
            <p className="text-sm text-red-500 mt-1">{state.errors.customLabel[0]}</p>
          )}
        </div>
      )}

      <VisibilityField defaultValue={defaultValues?.visibility ?? "shared"} />

      {state?.errors?._ && <p className="text-sm text-red-500">{state.errors._[0]}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2 px-4 bg-accent text-white rounded-lg hover:bg-accent-strong disabled:opacity-50"
      >
        {pending ? dict.common.saving : (submitLabel ?? dict.transactions.recurring.createRule)}
      </button>
    </form>
  );
}
