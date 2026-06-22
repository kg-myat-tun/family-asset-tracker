"use client";

import { useActionState, useState } from "react";
import type { AssetFormState } from "@/actions/asset.actions";
import { useI18n } from "@/components/i18n/I18nProvider";
import { SymbolCombobox } from "@/components/ui/SymbolCombobox";
import { VisibilityField } from "@/components/ui/VisibilityField";
import { isDynamicAsset } from "@/lib/asset-price";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import type { Asset, AssetCategory } from "@/types";

const CATEGORIES = ["cash", "bank", "investment", "property", "crypto", "stock", "other"] as const;

interface Props {
  action: (prevState: AssetFormState, formData: FormData) => Promise<AssetFormState>;
  defaultValues?: Partial<Asset>;
  submitLabel?: string;
}

export function AssetForm({ action, defaultValues, submitLabel }: Props) {
  const { dict } = useI18n();
  const [state, formAction, pending] = useActionState<AssetFormState, FormData>(action, null);
  const [category, setCategory] = useState<AssetCategory>(defaultValues?.category ?? "cash");
  const dynamic = isDynamicAsset(category);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="asset-name" className="block text-sm font-medium text-foreground/80 mb-1">
          {dict.assets.name}
        </label>
        <input
          id="asset-name"
          name="name"
          defaultValue={defaultValues?.name}
          required
          className="w-full px-4 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-soft"
        />
        {state?.errors?.name && <p className="text-sm text-red-500 mt-1">{state.errors.name[0]}</p>}
      </div>

      <div>
        <label
          htmlFor="asset-category"
          className="block text-sm font-medium text-foreground/80 mb-1"
        >
          {dict.assets.category}
        </label>
        <select
          id="asset-category"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as AssetCategory)}
          className="w-full px-4 py-2 border border-line rounded-lg"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {dict.assets.categories[c as AssetCategory]}
            </option>
          ))}
        </select>
      </div>

      {dynamic ? (
        <div className="flex gap-3">
          {/* Dynamic assets are priced in USD; the form omits a currency picker. */}
          <input type="hidden" name="currency" value="USD" />
          <div className="flex-1">
            {/* Remount on category change so a stale crypto/stock pick is cleared. */}
            <SymbolCombobox
              key={category}
              category={category}
              defaultValue={defaultValues?.symbol}
              label={dict.assets.symbol}
              placeholder={category === "crypto" ? "BTC" : "AAPL"}
              error={state?.errors?.symbol?.[0]}
            />
          </div>
          <div className="flex-1">
            <label
              htmlFor="asset-quantity"
              className="block text-sm font-medium text-foreground/80 mb-1"
            >
              {dict.assets.quantity}
            </label>
            <input
              id="asset-quantity"
              name="quantity"
              type="number"
              step="any"
              min="0"
              inputMode="decimal"
              defaultValue={defaultValues?.quantity ?? ""}
              required
              className="w-full px-4 py-2 border border-line rounded-lg"
            />
            {state?.errors?.quantity && (
              <p className="text-sm text-red-500 mt-1">{state.errors.quantity[0]}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <div className="flex-1">
            <label
              htmlFor="asset-amount"
              className="block text-sm font-medium text-foreground/80 mb-1"
            >
              {dict.assets.amount}
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
              className="w-full px-4 py-2 border border-line rounded-lg"
            />
            {state?.errors?.amount && (
              <p className="text-sm text-red-500 mt-1">{state.errors.amount[0]}</p>
            )}
          </div>
          <div className="w-32">
            <label
              htmlFor="asset-currency"
              className="block text-sm font-medium text-foreground/80 mb-1"
            >
              {dict.assets.currency}
            </label>
            <select
              id="asset-currency"
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
      )}

      <div>
        <label
          htmlFor="asset-description"
          className="block text-sm font-medium text-foreground/80 mb-1"
        >
          {dict.assets.descriptionOptional}
        </label>
        <textarea
          id="asset-description"
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
        {pending ? dict.common.saving : (submitLabel ?? dict.assets.createAsset)}
      </button>
    </form>
  );
}
