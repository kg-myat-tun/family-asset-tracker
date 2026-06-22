// Pure helpers for dynamic (market-priced) assets — safe on both server and
// client (no Firestore / no "server-only"). Mirrors the currency.ts convention.
// The Firestore/network-backed price fetching lives in asset-price.server.ts.

import type { AssetCategory } from "@/types";

// A selectable ticker suggestion for the symbol combobox. `value` is the bare
// symbol persisted on the asset; `label` is the human-friendly display string.
export interface SymbolOption {
  value: string;
  label: string;
}

// Stock and crypto assets are "dynamic": their value is quantity × live price,
// computed server-side, rather than a hand-entered amount.
export function isDynamicAsset(category: AssetCategory): boolean {
  return category === "stock" || category === "crypto";
}

// Tickers are matched case-insensitively against the price providers.
export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}
