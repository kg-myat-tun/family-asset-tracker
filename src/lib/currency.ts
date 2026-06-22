// Pure currency helpers — safe on both server and client (no Firestore / no
// "server-only"). Firestore-backed rate fetching lives in currency.server.ts.
// Mirrors the visibility.ts / loan-interest.ts shared-logic convention.

// Single source of truth for the currency dropdowns (asset/loan forms, onboarding).
// USD and MMK lead since this is a Myanmar family tracker.
export const SUPPORTED_CURRENCIES = [
  "USD",
  "MMK",
  "THB",
  "EUR",
  "GBP",
  "JPY",
  "SGD",
  "AUD",
  "CAD",
  "CNY",
  "HKD",
  "KRW",
] as const;

// MMK per 1 USD — market fallback used when the CBM API is unreachable or a family
// predates the per-family settings.mmkPerUsd field. The FX provider (Frankfurter)
// does not supply an MMK rate, so it is injected server-side; see currency.server.ts.
export const DEFAULT_MMK_PER_USD = 4500;

// Currencies conventionally written without minor units. MMK/JPY/KRW amounts are
// whole-number and large, so rendering ".00" is both unusual and noisy.
const ZERO_DECIMAL_CURRENCIES = new Set(["MMK", "JPY", "KRW"]);

export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
): number {
  if (fromCurrency === toCurrency) return amount;
  const fromRate = rates[fromCurrency] ?? 1;
  const toRate = rates[toCurrency] ?? 1;
  return (amount / fromRate) * toRate;
}

export function formatCurrency(amount: number, currency: string, locale = "en-US"): string {
  const fractionDigits = ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}
