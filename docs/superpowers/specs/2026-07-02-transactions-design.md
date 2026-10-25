# Transactions (Income & Expenses) — Design

**Date:** 2026-07-02
**Status:** Approved (design) — pending implementation plan

## Summary

Replace the just-added, unmerged Income feature with a unified **Transactions**
concept covering both income and expenses, with a budget-vs-actual model:

- **Recurring rules** (salary, rent, subscriptions) define an expected amount and
  cadence.
- A daily cron auto-posts a dated **transaction** for each rule when it comes due;
  users can also log one-off transactions by hand (a grocery run, a bonus).
- A monthly **summary snapshot** (recomputed daily for the current month) powers a
  dashboard card and a multi-month trend chart.

Transactions are a standalone cash-flow record — same as the superseded Income
feature, they are never summed into `totalNetWorth` and never adjust an Asset's
balance. This supersedes
`docs/superpowers/specs/2026-07-01-recurring-income-design.md`, whose "no
scheduler / no auto-accumulation" non-goals no longer hold now that the scope has
grown to include expenses and a trend view. None of the prior Income code has
been merged to `master`, so this is a clean replacement, not a migration.

## Decisions (from brainstorming)

- **Model:** budget (recurring rules) + actual (transactions), layered, not just a
  projection and not a pure manual ledger.
- **Auto-posting:** a cron creates dated transactions from active recurring rules;
  posted transactions are editable/deletable afterward like any other entry.
- **Unified, not parallel:** one Transaction/RecurringRule model with a
  `type: "income" | "expense"` field, not two separate features.
- **Standalone from assets:** no linkage to an Asset balance — avoids double-entry
  bugs and keeps the "flow, not balance" precedent income already established.
- **Categories:** fixed enum per type (matches the `Asset.category` convention).
  Selecting `"other"` reveals a free-text `customLabel` shown on that entry, but
  aggregation still buckets it under `"other"` — charts stay stable regardless of
  how many one-off labels accumulate.
- **Reporting:** current-month dashboard card (income / expense / net) + a
  dedicated `/transactions` page with history and a multi-month trend chart, via a
  stored `MonthlySummary` snapshot collection (mirrors `NetWorthSnapshot`).
- **Visibility of aggregates:** `MonthlySummary` totals include private
  transactions, same precedent as `NetWorthSnapshot` ("objective family metric",
  see `src/lib/networth.server.ts`) — a private transaction's *amount* moves the
  family-wide monthly total even though its details stay hidden from other
  members in list/detail views.
- **Route/nav name:** `/transactions`.

## Non-goals (YAGNI)

- No linkage between a transaction and an Asset balance (no double-entry
  bookkeeping).
- No fully user-defined/custom category taxonomy — fixed enum + `customLabel` on
  `"other"` only.
- No per-family timezone handling for due-date/month-boundary math — same UTC-day
  convention (`toISOString().split("T")[0]`) as the existing crons.
- No retroactive recomputation of historical `MonthlySummary` docs if
  `baseCurrency` changes later (same known limitation as `NetWorthSnapshot`).
- No start/end dates or pause scheduling beyond a simple `active` boolean on
  recurring rules.

## Data model

New domain types in `src/types/index.ts`:

```ts
export type TransactionType = "income" | "expense";

export type IncomeCategory = "salary" | "bonus" | "gift" | "investment" | "other";
export type ExpenseCategory =
  | "housing"
  | "groceries"
  | "utilities"
  | "transport"
  | "healthcare"
  | "entertainment"
  | "debt"
  | "other";

export type RecurringFrequency = "weekly" | "monthly" | "quarterly" | "yearly";

export interface RecurringRule {
  id: string;
  ownerId: string;
  type: TransactionType;
  name: string; // "Salary — Acme Corp"
  category: IncomeCategory | ExpenseCategory;
  customLabel: string | null; // shown instead of "Other" when category === "other"
  currency: string;
  amount: number; // per-occurrence
  frequency: RecurringFrequency;
  nextDueDate: Date; // advanced by the cron after each posting
  active: boolean; // pause without deleting
  visibility: Visibility;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  ownerId: string;
  type: TransactionType;
  name: string;
  category: IncomeCategory | ExpenseCategory;
  customLabel: string | null;
  currency: string;
  amount: number;
  date: Date; // when it actually happened
  recurringRuleId: string | null; // null = logged one-off by hand
  description: string;
  visibility: Visibility;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MonthlySummary {
  month: string; // "2026-07"
  totalIncomeBase: number;
  totalExpenseBase: number;
  netBase: number;
  byCategoryBase: Record<string, number>;
  baseCurrency: string;
  recordedAt: Date;
}
```

**Firestore layout:** `families/{familyId}/recurringRules/{ruleId}`,
`families/{familyId}/transactions/{transactionId}`,
`families/{familyId}/monthlySummaries/{YYYY-MM}` — parallel to `assets`, `loans`,
and `netWorthSnapshots`. Timestamps stored as Firestore `Timestamp`, converted to
`Date` in the lib layer, mirroring `docToAsset`/`docToIncome`.

## Layering (mirrors assets/income)

### `src/lib/recurring.server.ts` (`import "server-only"`)

- `getRecurringRules(familyId, viewerUid, ownerId?)`, `getRecurringRule`,
  `createRecurringRule`, `updateRecurringRule`, `softDeleteRecurringRule` — same
  shape as the current `income.server.ts` CRUD.
- `postDueRecurringTransactions(familyId)` — queries rules where
  `active == true && nextDueDate <= today`, creates a `Transaction` for each
  (`recurringRuleId` set, `date = nextDueDate`), and advances `nextDueDate` to the
  next period based on `frequency`. Idempotent: a rule is only due once its
  `nextDueDate` has passed, and posting immediately advances it, so a retried or
  delayed cron run cannot double-post.

### `src/lib/transactions.server.ts` (`import "server-only"`)

- `getTransactions(familyId, viewerUid, filters?)`, `getTransaction`,
  `createTransaction` (manual one-off, `recurringRuleId: null`),
  `updateTransaction`, `softDeleteTransaction`.
- Editing or deleting a transaction never touches the `RecurringRule` that
  generated it — postings are independent records once created.

### `src/lib/monthly-summary.server.ts` (`import "server-only"`)

- `recordMonthlySummary(familyId, month, baseCurrency, rates)` — sums that
  month's non-deleted transactions (all visibilities, per the aggregate
  precedent above), converts to base currency, upserts
  `monthlySummaries/{month}`.
- `getMonthlySummaries(familyId, limit)` — reads the last N months, oldest →
  newest, for the trend chart (mirrors `getNetWorthSnapshots`).

### `src/lib/cashflow.ts` (pure, client-safe, no `server-only`)

- `SUPPORTED_INCOME_CATEGORIES`, `SUPPORTED_EXPENSE_CATEGORIES`.
- `monthlyEquivalent(amount, frequency)` — adapted from the current
  `src/lib/income.ts`, used for showing a rule's normalized monthly amount before
  it's ever posted.

### `src/lib/visibility.ts`

- Add `canViewTransaction` and `canViewRecurringRule` — same rule as
  `canViewAsset`: `shared` visible to all, `private` visible only to
  `ownerId === viewerUid`. Note this only gates *itemized* reads; the
  `MonthlySummary` aggregate is computed visibility-agnostic (see Decisions).

### `src/actions/transactions.actions.ts` and `src/actions/recurring-rules.actions.ts` (`"use server"`)

Both follow the existing action shape: `requireUser()` → derive family →
Zod validation → role check (`assertCanMutate`: owner always allowed, otherwise
caller must be `admin`; viewers rejected up front) → lib call → `logActivity` →
`revalidatePath` (+ detail path) → `redirect`.

**Zod schema** (shared shape for both rules and manual transactions): `name`
(1–100), `type` (enum), `category` (enum, cross-checked against `type`),
`customLabel` (required, non-empty when `category === "other"`, otherwise
ignored/nulled — `superRefine`, same pattern as today's `receivedAt` check),
`currency` (length 3), `amount` (positive), `description` (≤500, default ""),
`visibility` (enum, default `"shared"`). Rules additionally validate `frequency`
and default `nextDueDate` to today on creation. Transactions additionally
validate `date`.

**Activity types:** extend the activity union with `transaction_added`,
`transaction_updated`, and `recurring_rule_added`. Auto-posted transactions from
the cron log activity too when `visibility === "shared"` (e.g. "Rent −$1,200
posted"), so the family activity feed reflects recurring postings. Private
entries log no activity, same as assets/income today.

### Cron — `src/app/api/recurring-transactions/route.ts`

- New cron entry in `vercel.json`: `{ "path": "/api/recurring-transactions",
"schedule": "0 3 * * *" }`, protected by `CRON_SECRET` (same guard as
  `/api/fx-rates` and `/api/reminders`).
- For every family: `postDueRecurringTransactions(familyId)`, then
  `recordMonthlySummary(familyId, currentMonth, baseCurrency, rates)` using the
  family's cached FX rates (same `applyMmkRate` treatment as the other crons).
  Recomputing the current month's summary daily (not just once at month-end)
  keeps the trend chart's latest point live.

### API route handlers

- `src/app/api/transactions/route.ts` + `[transactionId]/route.ts` — list/detail,
  re-running `requireUser()` + the lib helper + visibility filter.
- `src/app/api/recurring-rules/route.ts` + `[ruleId]/route.ts` — same shape.
- `src/app/api/monthly-summaries/route.ts` — list, for the trend chart's client
  refetch path.

### `src/lib/query/keys.ts`

New family-scoped blocks: `transactions.{all,list,detail}`,
`recurringRules.{all,list,detail}`, `monthlySummaries.list`.

## Dashboard integration

`src/lib/dashboard.server.ts`: replace the `income`-based `monthlyIncomeTotal`
block with a transactions-based computation over the current month —
`monthlyIncomeTotal`, `monthlyExpenseTotal`, and `monthlyNetTotal`, each summed
in base currency the same way `monthlyIncomeTotal` works today (live per-viewer
read, not the stored snapshot — the snapshot is for the trend chart only).
`totalNetWorth` and all existing totals are unchanged.

## Routes & UI — `src/app/(dashboard)/transactions/`

Mirrors the assets/income route structure:

- `page.tsx` — Server Component: `requireUser()` + `getTransactions` +
  `getMonthlySummaries`, `prefetchQuery`s into `getQueryClient()`, wraps the
  client view (current-month totals, filterable history list, trend chart) in
  `<HydrationBoundary>`.
- `new/` — log a one-off transaction.
- `[transactionId]/` — detail/edit/delete.
- `recurring/` — manage recurring rules: list, add, edit, pause (`active`
  toggle), delete.
- `loading.tsx` / `error.tsx` per segment.

Client components consume data via `useQuery` keyed from `keys.transactions` /
`keys.recurringRules` / `keys.monthlySummaries`, `queryFn` hitting the Route
Handlers through `fetchJson`. The trend chart component follows the existing
net-worth trend chart's structure.

**Navigation:** the "Income" nav link becomes "Transactions".

## Fate of the existing Income feature

None of the Income feature is merged to `master` (it's local-only on
`feat/recurring-income`), so it is fully replaced rather than migrated:

**Removed:** `src/lib/income.server.ts`, `src/lib/income.ts`,
`src/actions/income.actions.ts`, `src/app/api/income/**`,
`src/app/(dashboard)/income/**`, `src/components/income/**`, the `Income` /
`IncomeFrequency` types, `canViewIncome`, the `income` query-key block, the
income activity types, and the income i18n strings (`en` + `my`).

**Replaced by:** the Transactions equivalents described above.

## i18n

Add `transactions` strings (page/section titles, category labels, frequency
labels, dashboard card labels, empty states, recurring-rule management strings)
to both `en` and `my` dictionaries in `src/lib/i18n/`, replacing the removed
`income` block.

## Firestore rules

No change required. All reads (including the trend chart and history list) go
through the Admin SDK server-side and the Route Handlers; there is no
client-side `onSnapshot` listener for transactions, so no new `allow read` rule
is needed.

## Edge cases

- **Cron idempotency:** `nextDueDate` is advanced immediately on posting, so a
  retried/delayed cron run cannot double-post a rule for the same period.
- **Rule edits don't rewrite history:** changing a rule's amount/category only
  affects future postings; past `Transaction` docs are independent and never
  rewritten. Deleting or pausing a rule stops future postings but leaves past
  transactions intact.
- **Currency:** each transaction keeps its own currency; `MonthlySummary` totals
  are computed in `baseCurrency` at write time and are not retroactively
  recomputed if `baseCurrency` later changes (same limitation as
  `NetWorthSnapshot`).
- **Timezone:** due-date/month-boundary comparisons use the same UTC-day
  convention as the existing crons — no per-family timezone handling.
- **Permissions:** identical to income today — viewers cannot create
  transactions or rules; only the owner or a family admin can edit/delete
  someone else's.

## Testing / verification

No test runner is configured in this repo. Verification is:

- `pnpm build` passes with zero TypeScript errors.
- `pnpm lint` passes clean (Biome).
- Manual smoke test:
  - Create a recurring rule; manually invoke the cron route with `CRON_SECRET`
    to confirm it posts a transaction and advances `nextDueDate`; invoke it
    again the same day and confirm no double-post.
  - Log a one-off transaction with category `"other"` + a `customLabel`; confirm
    the label displays on the entry but the monthly summary still buckets it
    under `"other"`.
  - Confirm the dashboard's income/expense/net totals match a hand-computed sum
    for the current month.
  - Confirm the trend chart renders correctly from a few synthetic
    `monthlySummaries` docs.
  - Confirm a private transaction is hidden from other members in list/detail
    views but still moves the aggregate monthly totals.
  - Confirm a viewer role is blocked from creating a transaction or rule, and
    that a non-owner, non-admin member cannot edit/delete someone else's.

## Affected / new files

**New:** `src/lib/recurring.server.ts`, `src/lib/transactions.server.ts`,
`src/lib/monthly-summary.server.ts`, `src/lib/cashflow.ts`,
`src/actions/transactions.actions.ts`, `src/actions/recurring-rules.actions.ts`,
`src/app/api/recurring-transactions/route.ts`,
`src/app/api/transactions/route.ts` + `[transactionId]/route.ts`,
`src/app/api/recurring-rules/route.ts` + `[ruleId]/route.ts`,
`src/app/api/monthly-summaries/route.ts`,
`src/app/(dashboard)/transactions/**` (page, new, recurring, [transactionId],
loading, error, client components).

**Edited:** `src/types/index.ts` (`TransactionType`, `IncomeCategory`,
`ExpenseCategory`, `RecurringFrequency`, `RecurringRule`, `Transaction`,
`MonthlySummary`), `src/lib/visibility.ts` (`canViewTransaction`,
`canViewRecurringRule`), `src/lib/query/keys.ts` (transactions/recurringRules/
monthlySummaries keys), `src/lib/dashboard.server.ts` (monthly income/expense/
net totals), `src/lib/activity.server.ts` (new activity types), dashboard view
(income/expense card), nav component, `src/lib/i18n/**` dictionaries,
`vercel.json` (new cron entry).

**Removed:** the entire existing Income feature (see "Fate of the existing
Income feature" above).
