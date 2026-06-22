# Phase 11 — Myanmar Kyat (MMK) Currency

## Goal

Make **MMK** a first-class currency (selectable as an asset/loan/base currency) with
**correct conversion**, despite the FX provider not supplying an MMK rate.

The app fetches rates from `api.frankfurter.app` (ECB reference rates), which **does not
include MMK**. Without intervention `convertAmount` falls back to `rates["MMK"] ?? 1`,
treating **1 MMK = 1 USD** — so every cross-currency figure (the "≈ base" lines on the
asset/loan lists, dashboard net-worth totals, and a repayment's `exchangeRateUsed`) is
badly wrong whenever MMK mixes with another currency.

Design decisions:

- The MMK→USD rate is a **per-family setting** (`families/{id}.settings.mmkPerUsd`),
  editable by a family **admin**.
- Its default is **seeded from the Central Bank of Myanmar (CBM) API**
  (`https://forex.cbm.gov.mm/api/latest`, where `rates.USD` is MMK per 1 USD), falling
  back to a market constant when the fetch fails.
- MMK is displayed **without decimal places** (this also corrects JPY/KRW, which today
  are forced to `.00`).

The rates map is USD-based (`rates[X]` = units of X per 1 USD), so the whole fix reduces
to injecting `rates.MMK = mmkPerUsd` at the two server-side rate sources. Everything
downstream (`convertAmount` in assets/loans/dashboard/networth/repayments) then works
unchanged.

---

## Step 1 — Data model: `settings.mmkPerUsd`

```typescript
// src/lib/currency.ts  (pure, client-safe)
// Market fallback used when CBM is unreachable or a family predates this field.
export const DEFAULT_MMK_PER_USD = 4500;
```

```typescript
// src/types/index.ts — Family interface
export interface Family {
  // ...existing fields...
  baseCurrency: string;
  mmkPerUsd: number; // MMK per 1 USD, per-family (settings.mmkPerUsd)
}
```

```typescript
// src/lib/family.server.ts — getFamilyForUser mapper
return {
  // ...
  baseCurrency: data.settings?.baseCurrency ?? "USD",
  mmkPerUsd: data.settings?.mmkPerUsd ?? DEFAULT_MMK_PER_USD,
};
```

The setting lives next to `baseCurrency` under `families/{id}.settings`. Existing families
with no `mmkPerUsd` field fall back to `DEFAULT_MMK_PER_USD` until an admin sets one.

---

## Step 2 — CBM default fetch + seed at family creation

```typescript
// src/lib/currency.server.ts
const CBM_API = "https://forex.cbm.gov.mm/api/latest";

// Returns MMK per 1 USD from CBM, or null on any failure. Cached/tagged like the
// Frankfurter fetch so it is cheap and force-refreshable.
export async function fetchCbmUsdRate(): Promise<number | null> {
  try {
    const res = await fetch(CBM_API, {
      next: { revalidate: 3600, tags: ["fx-rates"] },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const { rates } = (await res.json()) as { rates?: Record<string, string> };
    const raw = rates?.USD;
    if (!raw) return null;
    const value = Number(raw.replace(/,/g, ""));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}
```

`createFamily` seeds the rate when the family doc is created:

```typescript
// src/lib/family.server.ts — createFamily
const mmkPerUsd = (await fetchCbmUsdRate()) ?? DEFAULT_MMK_PER_USD;
batch.set(familyRef, {
  // ...
  settings: { baseCurrency, mmkPerUsd },
});
```

---

## Step 3 — Inject the rate (the conversion fix)

```typescript
// src/lib/currency.server.ts
export function applyMmkRate(
  rates: Record<string, number>,
  mmkPerUsd: number,
): Record<string, number> {
  return { ...rates, MMK: mmkPerUsd };
}
```

Inject at both server-side rate sources:

- **`getCachedRates(familyId)`** — after assembling `rates`, read the family's
  `settings.mmkPerUsd` (one extra doc read; fallback to `DEFAULT_MMK_PER_USD`) and return
  `applyMmkRate(rates, mmkPerUsd)`. This covers every live UI read; the function signature
  is unchanged, so no caller churn.
- **`src/app/api/fx-rates/route.ts` (daily cron)** — it already iterates
  `familiesSnap.docs`, so read `familyDoc.data().settings?.mmkPerUsd` and inject into the
  `rates` passed to `recordNetWorthSnapshot`, keeping daily net-worth snapshots correct.

No other call sites change — `convertAmount` already reads `rates.MMK`.

---

## Step 4 — Admin editing UI (per-family)

```typescript
// src/lib/family.server.ts
export async function updateFamilySettings(
  familyId: string,
  settings: { mmkPerUsd: number },
): Promise<void> {
  await getAdminDb()
    .doc(`families/${familyId}`)
    .set({ settings }, { merge: true });
}
```

```typescript
// src/actions/family.actions.ts
const MmkRateSchema = z.object({
  mmkPerUsd: z.coerce.number().positive().max(1_000_000),
});

export async function updateMmkRateAction(_prev: unknown, formData: FormData) {
  const { family } = await requireAdmin(); // admin gate, see member.actions.ts:9
  const parsed = MmkRateSchema.safeParse({ mmkPerUsd: formData.get("mmkPerUsd") });
  if (!parsed.success) return { error: "Enter a valid rate" };
  await updateFamilySettings(family.id, { mmkPerUsd: parsed.data.mmkPerUsd });
  revalidatePath("/", "layout");
  return { ok: true };
}
```

A second action re-seeds from CBM on demand (the "Use CBM rate" button):

```typescript
export async function refreshMmkRateFromCbmAction() {
  const { family } = await requireAdmin();
  const rate = (await fetchCbmUsdRate()) ?? DEFAULT_MMK_PER_USD;
  await updateFamilySettings(family.id, { mmkPerUsd: rate });
  revalidatePath("/", "layout");
}
```

UI: surface a small "Family settings" card on the existing admin page
`src/app/(dashboard)/members/page.tsx` (it already computes `isAdmin`). New component
`src/components/members/MmkRateForm.tsx` — a number input prefilled with the current rate
+ Save, plus a "Use CBM rate" button. The `requireAdmin` helper currently lives inside
`member.actions.ts`; extract it to a shared server util (e.g. `src/lib/auth.server.ts`)
so both action files can reuse it.

---

## Step 5 — Currency list + formatting

Consolidate the four duplicated `COMMON_CURRENCIES` arrays into one source and add MMK:

```typescript
// src/lib/currency.ts
export const SUPPORTED_CURRENCIES = [
  "USD", "MMK", "THB", "EUR", "GBP", "JPY", "SGD", "AUD", "CAD", "CNY", "HKD", "KRW",
] as const;

const ZERO_DECIMAL_CURRENCIES = new Set(["MMK", "JPY", "KRW"]);

export function formatCurrency(amount: number, currency: string, locale = "en-US"): string {
  const fractionDigits = ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}
```

Import `SUPPORTED_CURRENCIES` in `AssetForm.tsx`, `LoanForm.tsx`, `LoanEditForm.tsx`, and
`OnboardingForm.tsx`, replacing their local arrays. This prevents the lists from drifting
(e.g. MMK showing in assets but not loans).

Currency Zod validation stays `z.string().length(3)` — MMK already passes; there is no
enum to extend.

---

## Step 6 — i18n + docs

- Add MMK-rate setting strings to `src/lib/i18n/dictionaries.ts` (`en` + `my`): card
  title, rate label/help, save button, "Use CBM rate" button.
- Update `CLAUDE.md` (the FX section): note that Frankfurter omits MMK, and that MMK is
  handled via a per-family `settings.mmkPerUsd` seeded from CBM and injected in
  `getCachedRates` / the fx cron.
- Update `doc/00-master.md`: add `11-mmk-currency.md` to the File Execution Order and note
  `settings.mmkPerUsd` in the data model / multi-currency section.

---

## Out of scope

- No new env var — the rate is per-family in Firestore.
- No daily auto-refresh of the per-family rate from CBM (manual edit + on-demand "Use CBM
  rate" button only, so a cron never clobbers an admin override). Can be added later as a
  flagged cron step.

---

## Acceptance

- `npx tsc --noEmit` and `biome check` clean; `pnpm build` passes.
- New family → `families/{id}.settings.mmkPerUsd` seeded from CBM (~2100), market fallback otherwise.
- Base = USD, an MMK 2,100,000 asset shows ≈ $1,000 (not ≈ $2.1M); dashboard totals agree.
- Admin edits the rate on the members page → "≈ base" figures move after revalidation.
- MMK renders without decimals ("K 2,100,000").
- Base = MMK with all-MMK items → exact, no conversion applied.
