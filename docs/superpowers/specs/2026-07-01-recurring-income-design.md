# Recurring Income Streams — Design

**Date:** 2026-07-01
**Status:** Approved (design) — pending implementation plan

## Summary

Add a first-class **income** concept, separate from assets, for recurring earnings
like a monthly salary. Income streams are recorded per family member, normalized to
a monthly-equivalent figure, and surfaced on a dedicated `/income` page and a
dashboard card. **Income never enters the net-worth total** — a salary is a flow,
not a stored balance, so it is displayed alongside net worth, not summed into it.

The feature is a straight vertical copy of the existing assets feature: same
ownership/visibility/permission model, same server/lib/action layering, same
TanStack Query + Route Handler read path, same soft-delete and activity logging.

## Decisions (from brainstorming)

- **Core behavior:** track income separately; shown on the dashboard but NOT summed
  into net worth as a balance.
- **Frequencies:** full set + one-off — `weekly | monthly | quarterly | yearly | one_off`.
- **Model parity:** full parity with assets — per-owner, currency, shared/private
  visibility, role checks (viewers cannot add; non-owners need `admin` to edit
  another member's income).
- **Placement:** dedicated `/income` route (list + add/edit/delete) plus a dashboard
  card showing the monthly-equivalent income total.

## Non-goals (YAGNI)

- No scheduler / auto-accumulation of income into a running balance.
- No future-projection math ("in 6 months you'll have +X").
- No start/end dates for recurring streams; no edit history.
- Income is never added to `totalNetWorth`.

## Data model

New domain types in `src/types/index.ts`:

```ts
export type IncomeFrequency = "weekly" | "monthly" | "quarterly" | "yearly" | "one_off";

export interface Income {
  id: string;
  ownerId: string;
  name: string;            // e.g. "Salary — Acme Corp"
  currency: string;
  amount: number;          // per-occurrence amount, in `currency`
  frequency: IncomeFrequency;
  receivedAt: Date | null; // date for one_off; null for recurring frequencies
  description: string;
  visibility: Visibility;  // "shared" | "private"
  deleted: boolean;        // soft-delete, like assets
  createdAt: Date;
  updatedAt: Date;
}
```

**Firestore layout:** `families/{familyId}/income/{incomeId}` — a new subcollection
parallel to `assets`. Timestamps stored as Firestore `Timestamp`, converted to `Date`
in the lib layer (`docToIncome`), mirroring `docToAsset`.

Rationale for storing per-occurrence `amount` + `frequency` (rather than a
pre-normalized monthly number): it preserves the user's actual figures (a yearly
bonus reads as its real yearly amount on the detail page), and normalization is a
pure, cheap derivation done at display time.

## Monthly-equivalent normalization

Pure, client-safe helper in a new `src/lib/income.ts` (no `server-only`, so both
sides can use it):

```ts
export function monthlyEquivalent(amount: number, frequency: IncomeFrequency): number {
  switch (frequency) {
    case "weekly":    return amount * 52 / 12;
    case "monthly":   return amount;
    case "quarterly": return amount / 3;
    case "yearly":    return amount / 12;
    case "one_off":   return 0; // excluded from the recurring monthly figure
  }
}
```

`src/lib/income.ts` also exports `SUPPORTED_FREQUENCIES` (the selectable list for the
form) and a `FREQUENCY_LABELS` mapping (or i18n keys) for rendering.

**One-off handling:** one-off income is listed on the `/income` page with its
`receivedAt` date, but contributes `0` to the monthly-equivalent total and to the
dashboard card. It is recorded for completeness/history, not projected.

## Layering (mirrors assets)

All new files follow the three-layer rule already documented in `CLAUDE.md`.

### `src/lib/income.server.ts` (`import "server-only"`)

Typed Firestore helpers using `getAdminDb()`:

- `getIncomes(familyId, viewerUid, ownerId?): Promise<Income[]>` — query
  `deleted == false`, order by `createdAt desc`, optional `ownerId` filter, then
  `.filter(canViewIncome(_, viewerUid))`.
- `getIncome(familyId, incomeId): Promise<Income | null>` — returns null if missing
  or soft-deleted.
- `createIncome(familyId, ownerId, data): Promise<string>`.
- `updateIncome(familyId, incomeId, data): Promise<void>` — `stripUndefined` +
  `updatedAt` server timestamp.
- `softDeleteIncome(familyId, incomeId): Promise<void>`.

No live-price logic (income has no `applyLivePrices` equivalent).

### `src/lib/visibility.ts`

Add `canViewIncome(income, viewerUid)` with the same rule as `canViewAsset`:
`shared` is visible to all; `private` is visible only to `ownerId === viewerUid`.
(Admins do NOT see others' private income — consistent with the assets rule.)

### `src/lib/income.ts` (pure, client-safe)

`monthlyEquivalent`, `SUPPORTED_FREQUENCIES`, frequency label keys.

### `src/actions/income.actions.ts` (`"use server"`)

`createIncomeAction` / `updateIncomeAction` / `deleteIncomeAction`, each:
`requireUser()` → `getFamilyForUser` → Zod validation → role check
(`assertCanMutate` copied from asset actions: owner always allowed, otherwise caller
must be `admin`; viewers rejected up front) → lib call → `logActivity` →
`revalidatePath("/income")` (+ detail path) → `redirect`.

**Zod schema** validates: `name` (1–100), `currency` (length 3), `amount`
(positive number), `frequency` (enum), `receivedAt` (required when
`frequency === "one_off"`, otherwise ignored/nulled — enforced via `superRefine`),
`description` (≤500, default ""), `visibility` (enum, default "shared").

**Activity types:** extend the activity type union with `income_added` and
`income_updated`. Private income logs no activity and, on becoming private via edit,
calls `deleteActivityForItem` — same pattern as assets.

### API route handlers — `src/app/api/income/`

- `GET /api/income` — list (optional `?owner=` param), re-runs `requireUser()` +
  `getIncomes` + visibility filter, returns JSON.
- `GET /api/income/[incomeId]` — single income for the detail query.

These re-enforce auth and visibility server-side; the client never reads Firestore
for income directly. JSON dates are revived by `fetchJson` on the client.

### `src/lib/query/keys.ts`

New family-scoped block:

```ts
income: {
  all: (familyId: string) => ["income", familyId] as const,
  list: (familyId: string, owner?: string) =>
    ["income", familyId, "list", owner ?? null] as const,
  detail: (familyId: string, incomeId: string) =>
    ["income", familyId, "detail", incomeId] as const,
},
```

## Dashboard integration

Extend `getDashboardData` in `src/lib/dashboard.server.ts`:

- Fetch visible income for the family (add to the existing `Promise.all`).
- Compute `monthlyIncomeTotal = Σ convertAmount(monthlyEquivalent(i.amount, i.frequency), i.currency, baseCurrency, rates)` over visible income.
- Add `monthlyIncomeTotal: number` to the `DashboardData` interface.

`totalNetWorth` and all existing totals are unchanged — income is additive display
data only.

A new dashboard **card** renders `monthlyIncomeTotal` formatted via `formatCurrency`
in the base currency, labeled "Monthly income".

## Route & UI (`src/app/(dashboard)/income/`)

Mirror the assets route structure:

- `page.tsx` — Server Component: `requireUser()` + `getIncomes`, `prefetchQuery`
  into `getQueryClient()`, wrap client list in `<HydrationBoundary>`.
- `new/` — add form (Server Component shell + client form using the create action).
- `[incomeId]/` — detail + edit + delete.
- `loading.tsx`, `error.tsx` per segment.

Client list/detail components consume data via `useQuery` keyed from `keys.income`,
`queryFn` hitting the `/api/income` handlers through `fetchJson`.

The form surfaces: name, owner (defaults to current user; mirrors asset form),
amount, currency (from `SUPPORTED_CURRENCIES`), frequency (from
`SUPPORTED_FREQUENCIES`), a date picker shown only when frequency is `one_off`,
description, and visibility. Mobile-first, Tailwind only.

**Navigation:** add an "Income" link alongside Assets and Loans in the dashboard nav.

## i18n

Add income strings (page titles, form labels, frequency labels, dashboard card
label, empty state) to both `en` and `my` dictionaries in `src/lib/i18n/`.

## Firestore rules

No change required. Income is read server-side through the Admin SDK (which bypasses
rules); there is no client-side `onSnapshot` listener for income, so no `allow read`
rule is needed.

## Testing / verification

No test runner is configured in this repo. Verification is:

- `pnpm build` passes with zero TypeScript errors.
- `pnpm lint` passes clean (Biome).
- Manual smoke: create/edit/delete income of each frequency; confirm the monthly
  card total updates and matches hand-computed normalization; confirm one-off
  contributes 0 to the card; confirm private income is hidden from other members and
  that a viewer cannot add income; confirm net worth is unchanged by income.

## Affected / new files

**New:** `src/lib/income.server.ts`, `src/lib/income.ts`,
`src/actions/income.actions.ts`, `src/app/api/income/route.ts`,
`src/app/api/income/[incomeId]/route.ts`,
`src/app/(dashboard)/income/**` (page, new, [incomeId], loading, error, client
components).

**Edited:** `src/types/index.ts` (Income, IncomeFrequency),
`src/lib/visibility.ts` (canViewIncome), `src/lib/query/keys.ts` (income keys),
`src/lib/dashboard.server.ts` (monthlyIncomeTotal), activity type union +
`src/lib/activity.server.ts` mapping, dashboard view (income card), nav component,
`src/lib/i18n/**` dictionaries.
