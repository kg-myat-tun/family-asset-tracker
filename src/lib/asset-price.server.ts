import "server-only";

import { normalizeSymbol, type SymbolOption } from "@/lib/asset-price";
import { getRequiredEnv } from "@/lib/env";
import type { Asset, AssetCategory } from "@/types";

// Binance public market data — no API key. Symbols are quoted against USDT (≈ USD).
// We use the data-only `data-api.binance.vision` host rather than `api.binance.com`
// because the latter geo-blocks US IPs with HTTP 451, and Vercel's default region
// (iad1, US East) is one of them — so on production every crypto price came back
// null and assets showed $0. The data host serves the same endpoints unrestricted.
const BINANCE_API = "https://data-api.binance.vision/api/v3/ticker/price";
// Binance exchange metadata — lists every tradable pair (used for symbol search).
const BINANCE_EXCHANGE_INFO = "https://data-api.binance.vision/api/v3/exchangeInfo";
// Finnhub quote — free tier, needs FINNHUB_API_KEY. `c` is the current price.
const FINNHUB_API = "https://finnhub.io/api/v1/quote";
// Finnhub symbol search — returns matching stocks for a query string.
const FINNHUB_SEARCH = "https://finnhub.io/api/v1/search";

// Cap suggestions so the dropdown stays usable and payloads stay small.
const SYMBOL_RESULT_LIMIT = 25;

// Crypto prices change fast; stock quotes move slower. Cache windows mirror the
// FX fetch caching in currency.server.ts; the "asset-prices" tag allows a future
// cron to force-refresh with revalidateTag.
const CRYPTO_REVALIDATE = 60;
const STOCK_REVALIDATE = 900;

// Live USD unit price for a crypto symbol via Binance, or null on any failure.
async function fetchCryptoPrice(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(`${BINANCE_API}?symbol=${normalizeSymbol(symbol)}USDT`, {
      next: { revalidate: CRYPTO_REVALIDATE, tags: ["asset-prices"] },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const { price } = (await res.json()) as { price?: string };
    const value = Number(price);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

// Live USD unit price for a stock symbol via Finnhub, or null on any failure.
async function fetchStockPrice(symbol: string): Promise<number | null> {
  try {
    const token = getRequiredEnv("FINNHUB_API_KEY");
    const res = await fetch(`${FINNHUB_API}?symbol=${normalizeSymbol(symbol)}&token=${token}`, {
      next: { revalidate: STOCK_REVALIDATE, tags: ["asset-prices"] },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const { c } = (await res.json()) as { c?: number };
    return Number.isFinite(c) && (c ?? 0) > 0 ? (c as number) : null;
  } catch {
    return null;
  }
}

// USD unit price for a dynamic asset's symbol, or null when unavailable / static.
// Prices from both providers are treated as USD (see doc/12-dynamic-asset-value.md).
export async function getAssetPrice(
  category: AssetCategory,
  symbol: string,
): Promise<number | null> {
  if (category === "crypto") return fetchCryptoPrice(symbol);
  if (category === "stock") return fetchStockPrice(symbol);
  return null;
}

// Overwrite amount/currency on dynamic assets with their live USD value
// (quantity × price). Static assets, and dynamic assets whose price fetch fails,
// are returned unchanged so they fall back to the stored snapshot.
export async function applyLivePrices(assets: Asset[]): Promise<Asset[]> {
  return Promise.all(
    assets.map(async (asset) => {
      if (!asset.symbol || asset.quantity == null) return asset;
      const price = await getAssetPrice(asset.category, asset.symbol);
      if (price == null) return asset;
      return { ...asset, amount: price * asset.quantity, currency: "USD" };
    }),
  );
}

// Crypto suggestions from Binance's USDT pairs, filtered by query. The full pair
// list rarely changes, so it is cached for a day (one shared fetch) and filtered
// in memory per request.
async function searchCryptoSymbols(query: string): Promise<SymbolOption[]> {
  try {
    const res = await fetch(BINANCE_EXCHANGE_INFO, {
      next: { revalidate: 86400, tags: ["asset-symbols"] },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const { symbols } = (await res.json()) as {
      symbols?: { baseAsset: string; quoteAsset: string; status: string }[];
    };
    const bases = (symbols ?? [])
      .filter((s) => s.quoteAsset === "USDT" && s.status === "TRADING")
      .map((s) => s.baseAsset);
    const seen = new Set<string>();
    const matches: SymbolOption[] = [];
    for (const base of bases) {
      if (query && !base.startsWith(query)) continue;
      if (seen.has(base)) continue;
      seen.add(base);
      matches.push({ value: base, label: base });
      if (matches.length >= SYMBOL_RESULT_LIMIT) break;
    }
    return matches;
  } catch {
    return [];
  }
}

// Stock suggestions from Finnhub's symbol search (needs an API key).
async function searchStockSymbols(query: string): Promise<SymbolOption[]> {
  if (!query) return [];
  try {
    const token = getRequiredEnv("FINNHUB_API_KEY");
    const res = await fetch(`${FINNHUB_SEARCH}?q=${encodeURIComponent(query)}&token=${token}`, {
      next: { revalidate: 86400, tags: ["asset-symbols"] },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const { result } = (await res.json()) as {
      result?: { symbol: string; description: string }[];
    };
    return (result ?? [])
      .filter((r) => r.symbol && !r.symbol.includes("."))
      .slice(0, SYMBOL_RESULT_LIMIT)
      .map((r) => ({
        value: r.symbol,
        label: r.description ? `${r.symbol} — ${r.description}` : r.symbol,
      }));
  } catch {
    return [];
  }
}

// Ticker suggestions for the symbol combobox. Returns [] for non-dynamic
// categories or on any provider failure (the field still accepts free text).
export async function searchSymbols(
  category: AssetCategory,
  query: string,
): Promise<SymbolOption[]> {
  const q = normalizeSymbol(query);
  if (category === "crypto") return searchCryptoSymbols(q);
  if (category === "stock") return searchStockSymbols(q);
  return [];
}
