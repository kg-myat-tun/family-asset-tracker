"use client";

import { useActionState } from "react";
import type { AssetFormState } from "@/actions/asset.actions";
import type { Asset } from "@/types";

const CATEGORIES = ["cash", "bank", "investment", "property", "crypto", "other"] as const;
const COMMON_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "THB",
  "JPY",
  "SGD",
  "AUD",
  "CAD",
  "CNY",
  "HKD",
  "KRW",
];

interface Props {
  action: (prevState: AssetFormState, formData: FormData) => Promise<AssetFormState>;
  defaultValues?: Partial<Asset>;
  submitLabel?: string;
}

export function AssetForm({ action, defaultValues, submitLabel = "Save asset" }: Props) {
  const [state, formAction, pending] = useActionState<AssetFormState, FormData>(action, null);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="asset-name" className="block text-sm font-medium text-gray-700 mb-1">
          Name
        </label>
        <input
          id="asset-name"
          name="name"
          defaultValue={defaultValues?.name}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {state?.errors?.name && <p className="text-sm text-red-500 mt-1">{state.errors.name[0]}</p>}
      </div>

      <div>
        <label htmlFor="asset-category" className="block text-sm font-medium text-gray-700 mb-1">
          Category
        </label>
        <select
          id="asset-category"
          name="category"
          defaultValue={defaultValues?.category ?? "cash"}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="asset-amount" className="block text-sm font-medium text-gray-700 mb-1">
            Amount
          </label>
          <input
            id="asset-amount"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            defaultValue={defaultValues?.amount}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
          {state?.errors?.amount && (
            <p className="text-sm text-red-500 mt-1">{state.errors.amount[0]}</p>
          )}
        </div>
        <div className="w-32">
          <label htmlFor="asset-currency" className="block text-sm font-medium text-gray-700 mb-1">
            Currency
          </label>
          <select
            id="asset-currency"
            name="currency"
            defaultValue={defaultValues?.currency ?? "USD"}
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

      <div>
        <label htmlFor="asset-description" className="block text-sm font-medium text-gray-700 mb-1">
          Description (optional)
        </label>
        <textarea
          id="asset-description"
          name="description"
          defaultValue={defaultValues?.description}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      {state?.errors?._ && <p className="text-sm text-red-500">{state.errors._[0]}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
