# Phase 12 — Dynamic Asset Value (Stocks & Crypto)

## Goal

Let **stock** and **crypto** assets carry a **live, market-driven value** instead of a
hand-typed amount. The user records a **ticker symbol + quantity held**; the app computes
the asset's worth server-side as `quantity × current market price` on every read.

This adds a new **`stock`** asset category alongside the existing `crypto`, and turns both
into "dynamic" assets whose `amount` is derived, not entered.

## Price sources

- **Crypto → Binance** public ticker API:
  `https://api.binance.com/api/v3/ticker/price?symbol={SYMBOL}USDT`. No API key. The symbol
  is stored bare (`BTC`) and a `USDT` quote pair is appended at fetch time; USDT ≈ USD, so
  the price is treated as USD.
- **Stock → Finnhub** quote API:
  `https://finnhub.io/api/v1/quote?symbol={SYMBOL}&token={FINNHUB_API_KEY}`. The free tier
  needs an API key (`FINNHUB_API_KEY`). The `c` field is the current price.

> **Why not Google Finance?** Google Finance has **no official public REST API** — the only
> "GoogleFinance" is a Google Sheets formula, and scraping the web page is fragile and
> against Google's ToS. Finnhub is a documented, ToS-clean stand-in with a free tier.

**Limitation (documented, accepted):** both feeds are treated as quoting in **USD**.
Non-US exchanges (Finnhub returns the listing's native currency) and non-USDT crypto pairs
may be mispriced. A `priceCurrency` field could be added later if multi-exchange support is
needed.

## Refresh model

Prices are fetched **on read**, cached by Next's `fetch` cache via `revalidate` — **crypto
~60s, stocks ~15min**. No new cron. The daily FX cron's net-worth snapshot picks up live
values automatically because it goes through the same read path (see Step 3).

---

## Design principle — inject the live `amount` at read time

The whole app (asset list/detail, dashboard, net-worth, FX conversion) already keys off
`Asset.amount` + `Asset.currency`. Rather than teach every consumer about `quantity × price`,
we compute the live value in the **server read helpers** and overwrite `amount`/`currency`
before the asset leaves the server — the same trick `applyMmkRate` uses for the missing MMK
rate (`src/lib/currency.server.ts`, see `doc/11-mmk-currency.md`). Everything downstream
stays unchanged.

The stored `amount` on the doc is kept as a **snapshot/fallback**: it is the last computed
value, used for sorting and when a price fetch fails.

---

## Step 1 — Data model + shared predicate

```typescript
// src/types/index.ts
export type AssetCategory =
  | "cash" | "bank" | "investment" | "property" | "crypto" | "stock" | "other";

export interface Asset {
  // ...existing fields...
  currency: string;
  amount: number;          // live value for dynamic assets; snapshot/fallback when offline
  symbol: string | null;   // ticker for stock/crypto (e.g. "AAPL", "BTC"); null otherwise
  quantity: number | null; // units held for stock/crypto; null otherwise
  // ...
}
```

```typescript
// src/lib/asset-price.ts  (pure, client-safe — like currency.ts)
import type { AssetCategory } from "@/types";

export function isDynamicAsset(category: AssetCategory): boolean {
  return category === "stock" || category === "crypto";
}

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}
```

---

## Step 2 — Price fetching (`src/lib/asset-price.server.ts`, `import "server-only"`)

Mirrors `currency.server.ts`: tagged `fetch` with `revalidate`, returns `null` on any
failure (never throws into a read).

```typescript
import "server-only";
import { getRequiredEnv } from "@/lib/env";
import { normalizeSymbol } from "@/lib/asset-price";
import type { Asset, AssetCategory } from "@/types";

const BINANCE_API = "https://api.binance.com/api/v3/ticker/price";
const FINNHUB_API = "https://finnhub.io/api/v1/quote";

async function fetchCryptoPrice(symbol: string): Promise<number | null> {
  // BTC -> BTCUSDT; USDT ≈ USD
  const res = await fetch(`${BINANCE_API}?symbol=${normalizeSymbol(symbol)}USDT`, {
    next: { revalidate: 60, tags: ["asset-prices"] },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const { price } = (await res.json()) as { price?: string };
  const value = Number(price);
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function fetchStockPrice(symbol: string): Promise<number | null> {
  const token = getRequiredEnv("FINNHUB_API_KEY");
  const res = await fetch(`${FINNHUB_API}?symbol=${normalizeSymbol(symbol)}&token=${token}`, {
    next: { revalidate: 900, tags: ["asset-prices"] },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const { c } = (await res.json()) as { c?: number }; // current price
  return Number.isFinite(c) && (c ?? 0) > 0 ? (c as number) : null;
}

// USD unit price for a dynamic asset, or null on failure / non-dynamic.
export async function getAssetPrice(
  category: AssetCategory,
  symbol: string,
): Promise<number | null> {
  if (category === "crypto") return fetchCryptoPrice(symbol);
  if (category === "stock") return fetchStockPrice(symbol);
  return null;
}

// Overwrite amount/currency on dynamic assets with live values (USD). Static
// assets and dynamic assets whose price fetch fails are returned unchanged.
export async function applyLivePrices(assets: Asset[]): Promise<Asset[]> {
  return Promise.all(
    assets.map(async (a) => {
      if (!a.symbol || a.quantity == null) return a;
      const price = await getAssetPrice(a.category, a.symbol);
      if (price == null) return a; // keep stored snapshot
      return { ...a, amount: price * a.quantity, currency: "USD" };
    }),
  );
}
```

`isDynamicAsset` is wrapped implicitly by the `symbol`/`quantity` guard, so static assets
short-circuit with no network call.

---

## Step 3 — Wire live prices into the read paths

Run reads through `applyLivePrices` so all consumers see live `amount`/`currency`:

- **`src/lib/assets.server.ts`** — `getAssets` (after the `canViewAsset` filter) and
  `getAsset`. Add `symbol`/`quantity` to `docToAsset`, `createAsset`, and `updateAsset`.
- **`src/lib/dashboard.server.ts`** — `applyLivePrices(assets)` after the asset mapping,
  before per-member totals.
- **`src/lib/networth.server.ts`** — in `computeFamilyNetWorth`, map docs to `Asset[]`, run
  `applyLivePrices`, then sum. This keeps the **daily cron snapshot** on live values. (One
  Finnhub call per stock asset per family per run — within free tier for a family tracker,
  and the `fetch` cache dedupes repeated symbols.)

The Route Handlers `src/app/api/assets/route.ts` and `.../[assetId]/route.ts` need **no
change** — they delegate to `getAssets`/`getAsset`, which now inject prices.

---

## Step 4 — Write path

```typescript
// src/actions/asset.actions.ts
const AssetSchema = z
  .object({
    name: z.string().min(1).max(100),
    category: z.enum(["cash", "bank", "investment", "property", "crypto", "stock", "other"]),
    currency: z.string().length(3),
    amount: z.coerce.number().positive().optional(),
    symbol: z.string().min(1).max(15).optional(),
    quantity: z.coerce.number().positive().optional(),
    description: z.string().max(500).optional().default(""),
    attachmentURL: z.string().url().optional().or(z.literal("")),
    visibility: z.enum(["private", "shared"]).default("shared"),
  })
  .superRefine((d, ctx) => {
    if (isDynamicAsset(d.category)) {
      if (!d.symbol) ctx.addIssue({ code: "custom", path: ["symbol"], message: "Symbol is required" });
      if (d.quantity == null) ctx.addIssue({ code: "custom", path: ["quantity"], message: "Quantity is required" });
    } else if (d.amount == null) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Amount is required" });
    }
  });
```

In the create/update actions, for a dynamic asset: `currency = "USD"`, `symbol` normalized,
and compute an initial `amount` snapshot via `getAssetPrice` (`price * quantity`, falling
back to `0` if the fetch fails) so the activity-log message and sort order have a real
value. Static assets keep their typed `amount`; `symbol`/`quantity` are `null`.

`createAsset`/`updateAsset` persist `symbol`, `quantity`, `amount` — the existing
`stripUndefined` helper already drops the unused fields.

---

## Step 5 — Form UI

```typescript
// src/components/assets/AssetForm.tsx
const CATEGORIES = ["cash", "bank", "investment", "property", "crypto", "stock", "other"] as const;
```

The form becomes category-aware (`useState`, seeded from `defaultValues`). When
`isDynamicAsset(category)`: render a **Symbol** picker + **Quantity** input and hide the
Amount + Currency fields (currency is implicitly USD). Otherwise render the current
Amount + Currency fields. Symbol/quantity default from `defaultValues`.

The symbol field is a searchable combobox (`src/components/ui/SymbolCombobox.tsx`): a
debounced `useQuery` hits `GET /api/asset-symbols?category=&q=` (auth-gated, key
server-side), which calls `searchSymbols` — Finnhub's `/search` for stocks, Binance's
`exchangeInfo` (USDT pairs, cached a day) for crypto. The chosen ticker is submitted via a
hidden `symbol` input, and the field still accepts free text if no option is picked.

`src/components/assets/AssetFilters.tsx`: add `"stock"` to its `CATEGORIES` array.

---

## Step 6 — Display

- **`src/components/assets/AssetList.tsx`** — add `stock` to `CATEGORY_ICONS` (e.g.
  `LineChart` from `lucide-react`). `amount` is already live, so list rows and totals are
  correct with no further change.
- **`src/components/assets/AssetDetailView.tsx`** — for dynamic assets, add a row showing
  holdings: `{quantity} {symbol} @ {livePrice}`, where the live unit price is derived as
  `amount / quantity`.

---

## Step 7 — i18n + env + docs

- **`src/lib/i18n/dictionaries.ts`**: add `stock` to the `categories` type interface and to
  both `en` (`"Stock"`) and `my` blocks; add `assets` labels for `symbol`, `quantity`, and a
  `holdings`/`livePrice` line (en + my).
- **`.env.example`**: add `FINNHUB_API_KEY=`.
- **`doc/00-master.md`**: add `12-dynamic-asset-value.md` to the File Execution Order and note
  `symbol`/`quantity` + the `stock` category in the shared `Asset` type.
- **`CLAUDE.md`**: note the dynamic-asset price injection (Binance/Finnhub, on-read cache,
  `applyLivePrices`) in the data-model / multi-currency section.

---

## Out of scope

- No `priceCurrency` / multi-exchange support — all prices are treated as USD.
- No portfolio history beyond the existing daily net-worth snapshot.
- No optimistic/intraday auto-refresh in the UI beyond the `fetch` cache windows.

---

## Acceptance

- `pnpm lint` clean; `pnpm build` passes with zero TypeScript errors.
- Crypto asset `BTC` × `0.5` → value ≈ `0.5 ×` live BTC price (USD), converted to base
  currency on list/detail/dashboard; differs from a stored static asset after the cache window.
- Stock asset `AAPL` × `10` → value ≈ `10 ×` AAPL price.
- Bad symbol (`ZZZZ`) → falls back to the stored snapshot, no crash.
- Switching category in the form swaps symbol/quantity ↔ amount/currency fields.
- Static assets (cash/bank/etc.) behave exactly as before.
- `FINNHUB_API_KEY` documented in `.env.example` with no real value.
