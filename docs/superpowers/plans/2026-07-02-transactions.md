# Transactions (Income & Expenses) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unmerged Income feature with a unified Transactions feature covering both income and expenses: recurring rules that auto-post dated transactions via a daily cron, one-off manual entries, a current-month dashboard card, and a multi-month trend chart backed by a stored monthly summary snapshot.

**Architecture:** Two new Firestore subcollections (`recurringRules`, `transactions`) plus a `monthlySummaries` snapshot collection, following the same `*.server.ts` / `"use server"` action / Route Handler / TanStack Query layering as the assets and (superseded) income features. A daily cron posts due recurring transactions and recomputes the current month's summary. Fully replaces `src/lib/income.server.ts` and everything downstream of it.

**Tech Stack:** Next.js 16 App Router, React 19, Firebase Admin SDK (Firestore), TanStack Query, Zod, Recharts, Tailwind v4, Biome.

## Global Constraints

- **Package manager:** pnpm only. Never npm/yarn.
- **TypeScript strict:** no `any`, no `@ts-ignore`.
- **No test runner exists.** Verification per task = `pnpm build` (zero TS errors) and `pnpm lint` (Biome clean), plus manual smoke where noted. There is no Jest/Vitest; do NOT add one.
- **Three-layer rule:** Firestore access only in `src/lib/*.server.ts`; actions validate with Zod, log activity, `revalidatePath`; pages stay thin.
- **Never trust client identity:** always resolve family from the verified session (`getFamilyForUser(user.uid)` / `getRouteContext()`).
- **Transactions never enter net worth.** `totalNetWorth` and its inputs are unchanged; income/expense totals are additive display data only.
- **No Firestore composite indexes exist in this repo** (no `firestore.indexes.json`). A query that combines an equality filter (`==`) with a range filter (`>`, `>=`, `<`, `<=`) on a *different* field requires one and will throw `failed-precondition` at runtime. Equality-only multi-filter queries and equality+`orderBy` queries are fine (already used throughout the codebase); a single range filter alone is fine. Where both are logically needed (current-month transaction queries), filter the equality condition (`deleted`) in application code after a range-only Firestore query — see Tasks 3 and 4.
- **Query keys** only from `src/lib/query/keys.ts` — never inline arrays.
- **No `console.log`** in committed code (`console.error` in `error.tsx` and cron catch blocks matches the existing pattern and is allowed).
- **Money:** always format via `formatCurrency`; convert via `convertAmount` with rates. Never render raw floats.
- **Biome format:** 2-space indent, 100 line width, double quotes, always semicolons. Run `pnpm lint:fix` before committing.
- **Firestore rules:** no change needed — transactions/recurring rules are read only through the Admin SDK; there is no client `onSnapshot` for either.
- **Visibility of aggregates:** `MonthlySummary` totals include private transactions (objective family metric, same precedent as `NetWorthSnapshot` in `src/lib/networth.server.ts`); itemized reads (lists/detail) still enforce `canViewTransaction`/`canViewRecurringRule`.

---

## File Structure

**New files:**
- `src/lib/cashflow.ts` — pure helpers (`SUPPORTED_INCOME_CATEGORIES`, `SUPPORTED_EXPENSE_CATEGORIES`, `SUPPORTED_RECURRING_FREQUENCIES`, `monthlyEquivalent`, `nextDueDateAfter`).
- `src/lib/recurring.server.ts` — `RecurringRule` CRUD + `postDueRecurringTransactions` (`server-only`).
- `src/lib/transactions.server.ts` — `Transaction` CRUD + `getCurrentMonthTransactions` (`server-only`).
- `src/lib/monthly-summary.server.ts` — `recordMonthlySummary` + `getMonthlySummaries` (`server-only`).
- `src/actions/recurring-rules.actions.ts` — create/update/delete/toggle-active actions + Zod schema.
- `src/actions/transactions.actions.ts` — create/update/delete actions + Zod schema.
- `src/app/api/recurring-transactions/route.ts` — daily cron: posts due transactions + records the current month's summary.
- `src/app/api/transactions/route.ts` — GET list handler.
- `src/app/api/transactions/[transactionId]/route.ts` — GET single handler.
- `src/app/api/recurring-rules/route.ts` — GET list handler.
- `src/app/api/recurring-rules/[ruleId]/route.ts` — GET single handler.
- `src/app/api/monthly-summaries/route.ts` — GET list handler.
- `src/app/(dashboard)/transactions/page.tsx` — list + totals + trend page.
- `src/app/(dashboard)/transactions/loading.tsx`, `error.tsx` — segment states.
- `src/app/(dashboard)/transactions/new/page.tsx` — add transaction form page.
- `src/app/(dashboard)/transactions/[transactionId]/page.tsx` — detail page.
- `src/app/(dashboard)/transactions/[transactionId]/edit/page.tsx` — edit form page.
- `src/app/(dashboard)/transactions/recurring/page.tsx` — recurring rules list page.
- `src/app/(dashboard)/transactions/recurring/loading.tsx` — segment skeleton.
- `src/app/(dashboard)/transactions/recurring/new/page.tsx` — add rule form page.
- `src/app/(dashboard)/transactions/recurring/[ruleId]/edit/page.tsx` — edit rule page.
- `src/components/transactions/TransactionForm.tsx`, `TransactionList.tsx`, `TransactionDetailView.tsx`, `TransactionsView.tsx`, `DeleteTransactionButton.tsx`, `CashflowTrend.tsx`.
- `src/components/transactions/RecurringRuleForm.tsx`, `RecurringRuleList.tsx`, `RecurringRulesView.tsx`, `DeleteRecurringRuleButton.tsx`, `PauseResumeButton.tsx`.

**Modified files:**
- `src/types/index.ts` — remove `Income`/`IncomeFrequency`; add `TransactionType`, `IncomeCategory`, `ExpenseCategory`, `RecurringFrequency`, `RecurringRule`, `Transaction`, `MonthlySummary`.
- `src/lib/visibility.ts` — remove `canViewIncome`; add `canViewTransaction`, `canViewRecurringRule`.
- `src/lib/activity.server.ts` — remove `income_added`/`income_updated`; add `transaction_added`, `transaction_updated`, `recurring_rule_added`, `recurring_rule_updated`.
- `src/lib/query/keys.ts` — remove `income` block; add `transactions`, `recurringRules`, `monthlySummaries`.
- `src/lib/dashboard.server.ts` — replace income-based total with transaction-based `monthlyIncomeTotal`, `monthlyExpenseTotal`, `monthlyNetTotal`.
- `src/components/dashboard/DashboardView.tsx` — swap the income stat tile for a net-cash-flow tile.
- `src/components/layout/Sidebar.tsx` — swap the Income nav link for Transactions.
- `src/lib/i18n/dictionaries.ts` — remove `income` block + `nav.income`; add `transactions` block + `nav.transactions` (en + my).
- `vercel.json` — add the `/api/recurring-transactions` cron entry.

**Removed files (Task 16):**
- `src/lib/income.server.ts`, `src/lib/income.ts`, `src/actions/income.actions.ts`
- `src/app/api/income/route.ts`, `src/app/api/income/[incomeId]/route.ts`
- `src/app/(dashboard)/income/**` (all files)
- `src/components/income/**` (all files)

---

## Task 1: Domain types, pure cash-flow helpers, and visibility

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/lib/cashflow.ts`
- Modify: `src/lib/visibility.ts`

**Interfaces:**
- Produces: `TransactionType`, `IncomeCategory`, `ExpenseCategory`, `RecurringFrequency`, `RecurringRule`, `Transaction`, `MonthlySummary` (types); `SUPPORTED_INCOME_CATEGORIES`, `SUPPORTED_EXPENSE_CATEGORIES`, `SUPPORTED_RECURRING_FREQUENCIES` (readonly arrays); `monthlyEquivalent(amount: number, frequency: RecurringFrequency): number`; `nextDueDateAfter(date: Date, frequency: RecurringFrequency): Date`; `canViewTransaction(t: Pick<Transaction, "ownerId" | "visibility">, viewerUid: string): boolean`; `canViewRecurringRule(r: Pick<RecurringRule, "ownerId" | "visibility">, viewerUid: string): boolean`.

- [ ] **Step 1: Replace the Income type alias and remove the Income interface**

In `src/types/index.ts`, replace this line (currently line 18):

```ts
export type IncomeFrequency = "weekly" | "monthly" | "quarterly" | "yearly" | "one_off";
```

with:

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
```

Then delete the entire `Income` interface block (currently lines 63–78):

```ts
export interface Income {
  id: string;
  ownerId: string;
  name: string;
  currency: string;
  // Per-occurrence amount in `currency` (e.g. one paycheck, one yearly bonus).
  amount: number;
  frequency: IncomeFrequency;
  // Date for one-off income; null for recurring frequencies.
  receivedAt: Date | null;
  description: string;
  visibility: Visibility;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

and replace it with:

```ts
export interface RecurringRule {
  id: string;
  ownerId: string;
  type: TransactionType;
  name: string; // "Salary — Acme Corp"
  category: IncomeCategory | ExpenseCategory;
  // Free-text label shown instead of "Other" when category === "other"; null otherwise.
  customLabel: string | null;
  currency: string;
  amount: number; // per-occurrence
  frequency: RecurringFrequency;
  // Next date the cron should post a Transaction for this rule; advances after each posting.
  nextDueDate: Date;
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
  // The RecurringRule that generated this transaction, or null if logged by hand.
  recurringRuleId: string | null;
  description: string;
  visibility: Visibility;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MonthlySummary {
  // "YYYY-MM" (also the document id), in the family's base currency. Includes
  // all transactions regardless of visibility — an objective family metric,
  // same precedent as NetWorthSnapshot.
  month: string;
  totalIncomeBase: number;
  totalExpenseBase: number;
  netBase: number;
  byCategoryBase: Record<string, number>;
  baseCurrency: string;
  recordedAt: Date;
}
```

- [ ] **Step 2: Create the pure cash-flow helper**

Create `src/lib/cashflow.ts`:

```ts
// Pure cash-flow helpers — safe on both server and client (no Firestore / no
// "server-only"). Mirrors the currency.ts / visibility.ts shared-logic convention.
import type { ExpenseCategory, IncomeCategory, RecurringFrequency } from "@/types";

export const SUPPORTED_INCOME_CATEGORIES = [
  "salary",
  "bonus",
  "gift",
  "investment",
  "other",
] as const satisfies readonly IncomeCategory[];

export const SUPPORTED_EXPENSE_CATEGORIES = [
  "housing",
  "groceries",
  "utilities",
  "transport",
  "healthcare",
  "entertainment",
  "debt",
  "other",
] as const satisfies readonly ExpenseCategory[];

export const SUPPORTED_RECURRING_FREQUENCIES = [
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
] as const satisfies readonly RecurringFrequency[];

// Normalizes a recurring rule's per-occurrence amount to its monthly-equivalent
// value, for display before it has ever been posted as an actual transaction.
export function monthlyEquivalent(amount: number, frequency: RecurringFrequency): number {
  switch (frequency) {
    case "weekly":
      return (amount * 52) / 12;
    case "monthly":
      return amount;
    case "quarterly":
      return amount / 3;
    case "yearly":
      return amount / 12;
  }
}

// Advances a due date to its next occurrence for a given cadence. Used by the
// recurring-transactions cron to move a rule's nextDueDate forward after
// posting. Works in UTC to match this repo's existing day-boundary convention
// (see the fx-rates/reminders crons' toISOString().split("T")[0] usage).
export function nextDueDateAfter(date: Date, frequency: RecurringFrequency): Date {
  const next = new Date(date);
  switch (frequency) {
    case "weekly":
      next.setUTCDate(next.getUTCDate() + 7);
      return next;
    case "monthly":
      next.setUTCMonth(next.getUTCMonth() + 1);
      return next;
    case "quarterly":
      next.setUTCMonth(next.getUTCMonth() + 3);
      return next;
    case "yearly":
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      return next;
  }
}
```

- [ ] **Step 3: Replace `canViewIncome` with `canViewTransaction` and `canViewRecurringRule`**

In `src/lib/visibility.ts`, replace the import line:

```ts
import type { Asset, Income, Loan } from "@/types";
```

with:

```ts
import type { Asset, Loan, RecurringRule, Transaction } from "@/types";
```

Then replace the `canViewIncome` function:

```ts
export function canViewIncome(
  income: Pick<Income, "ownerId" | "visibility">,
  viewerUid: string,
): boolean {
  return income.visibility === "shared" || income.ownerId === viewerUid;
}
```

with:

```ts
export function canViewTransaction(
  transaction: Pick<Transaction, "ownerId" | "visibility">,
  viewerUid: string,
): boolean {
  return transaction.visibility === "shared" || transaction.ownerId === viewerUid;
}

export function canViewRecurringRule(
  rule: Pick<RecurringRule, "ownerId" | "visibility">,
  viewerUid: string,
): boolean {
  return rule.visibility === "shared" || rule.ownerId === viewerUid;
}
```

- [ ] **Step 4: Verify build + lint**

```bash
pnpm lint:fix && pnpm build
```

Expected: this WILL fail — `src/lib/income.ts`, `src/lib/income.server.ts`, `src/actions/income.actions.ts`, the `income` API routes, `income` pages, and `income` components still import `Income`/`IncomeFrequency`/`canViewIncome`, which no longer exist. That is expected at this point in the plan; those files are deleted wholesale in Task 16 once everything that replaces them exists. Confirm the *only* errors are inside `src/lib/income.ts`, `src/lib/income.server.ts`, `src/actions/income.actions.ts`, `src/app/api/income/**`, `src/app/(dashboard)/income/**`, and `src/components/income/**` — if any error is outside those paths, stop and investigate before continuing.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/lib/cashflow.ts src/lib/visibility.ts
git commit -m "feat(transactions): add domain types, cashflow helpers, visibility"
```

---

## Task 2: Firestore helper for recurring rules (`recurring.server.ts`)

**Files:**
- Create: `src/lib/recurring.server.ts`

**Interfaces:**
- Consumes: `getAdminDb()` from `@/firebase/admin`; `nextDueDateAfter` from `@/lib/cashflow`; `canViewRecurringRule` from `@/lib/visibility`; `ExpenseCategory`, `IncomeCategory`, `RecurringFrequency`, `RecurringRule`, `TransactionType`, `Visibility` from `@/types`.
- Produces:
  - `getRecurringRules(familyId: string, viewerUid: string, ownerId?: string): Promise<RecurringRule[]>`
  - `getRecurringRule(familyId: string, ruleId: string): Promise<RecurringRule | null>`
  - `createRecurringRule(familyId, ownerId, data): Promise<string>` where `data` is `{ type; name; category; customLabel: string | null; currency; amount; frequency; visibility }`
  - `updateRecurringRule(familyId, ruleId, data: Partial<Pick<RecurringRule, "name" | "category" | "customLabel" | "currency" | "amount" | "frequency" | "active" | "visibility">>): Promise<void>`
  - `softDeleteRecurringRule(familyId, ruleId): Promise<void>`
  - `postDueRecurringTransactions(familyId: string): Promise<number>` — returns count posted.

- [ ] **Step 1: Create the helper**

Create `src/lib/recurring.server.ts`:

```ts
import "server-only";

import { FieldValue, type Query } from "firebase-admin/firestore";
import { getAdminDb } from "@/firebase/admin";
import { nextDueDateAfter } from "@/lib/cashflow";
import { canViewRecurringRule } from "@/lib/visibility";
import type {
  ExpenseCategory,
  IncomeCategory,
  RecurringFrequency,
  RecurringRule,
  TransactionType,
  Visibility,
} from "@/types";

function docToRecurringRule(doc: FirebaseFirestore.DocumentSnapshot): RecurringRule {
  const d = doc.data();
  if (!d) throw new Error("RecurringRule doc empty");
  return {
    id: doc.id,
    ownerId: d.ownerId,
    type: d.type,
    name: d.name,
    category: d.category,
    customLabel: d.customLabel ?? null,
    currency: d.currency,
    amount: d.amount,
    frequency: d.frequency,
    nextDueDate: d.nextDueDate.toDate(),
    active: d.active ?? true,
    visibility: d.visibility ?? "shared",
    deleted: d.deleted ?? false,
    createdAt: d.createdAt.toDate(),
    updatedAt: d.updatedAt.toDate(),
  };
}

export async function getRecurringRules(
  familyId: string,
  viewerUid: string,
  ownerId?: string,
): Promise<RecurringRule[]> {
  let query: Query = getAdminDb()
    .collection(`families/${familyId}/recurringRules`)
    .where("deleted", "==", false)
    .orderBy("createdAt", "desc");

  if (ownerId) query = query.where("ownerId", "==", ownerId);

  const snap = await query.get();
  return snap.docs.map(docToRecurringRule).filter((r) => canViewRecurringRule(r, viewerUid));
}

export async function getRecurringRule(
  familyId: string,
  ruleId: string,
): Promise<RecurringRule | null> {
  const snap = await getAdminDb().doc(`families/${familyId}/recurringRules/${ruleId}`).get();
  if (!snap.exists || snap.data()?.deleted) return null;
  return docToRecurringRule(snap);
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k as keyof T] = v as T[keyof T];
  }
  return out;
}

export async function createRecurringRule(
  familyId: string,
  ownerId: string,
  data: {
    type: TransactionType;
    name: string;
    category: IncomeCategory | ExpenseCategory;
    customLabel: string | null;
    currency: string;
    amount: number;
    frequency: RecurringFrequency;
    visibility: Visibility;
  },
): Promise<string> {
  const ref = getAdminDb().collection(`families/${familyId}/recurringRules`).doc();
  await ref.set({
    ...data,
    ownerId,
    nextDueDate: new Date(),
    active: true,
    deleted: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function updateRecurringRule(
  familyId: string,
  ruleId: string,
  data: Partial<
    Pick<
      RecurringRule,
      | "name"
      | "category"
      | "customLabel"
      | "currency"
      | "amount"
      | "frequency"
      | "active"
      | "visibility"
    >
  >,
): Promise<void> {
  await getAdminDb()
    .doc(`families/${familyId}/recurringRules/${ruleId}`)
    .update({
      ...stripUndefined(data),
      updatedAt: FieldValue.serverTimestamp(),
    });
}

export async function softDeleteRecurringRule(familyId: string, ruleId: string): Promise<void> {
  await getAdminDb().doc(`families/${familyId}/recurringRules/${ruleId}`).update({
    deleted: true,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// Posts a dated Transaction for every active, due RecurringRule, then advances
// nextDueDate past today. The equality filters below (deleted, active) are
// safe without a composite index; nextDueDate is compared in application code
// rather than as a third Firestore range filter, avoiding the
// equality+range-on-different-field combination that would require one (see
// Global Constraints). Advancing nextDueDate immediately after posting makes
// this idempotent: a retried/delayed cron run cannot double-post a rule for
// the same period.
export async function postDueRecurringTransactions(familyId: string): Promise<number> {
  const db = getAdminDb();
  const today = new Date();
  const snap = await db
    .collection(`families/${familyId}/recurringRules`)
    .where("deleted", "==", false)
    .where("active", "==", true)
    .get();

  const dueRules = snap.docs.map(docToRecurringRule).filter((rule) => rule.nextDueDate <= today);

  let posted = 0;
  for (const rule of dueRules) {
    const batch = db.batch();
    const txRef = db.collection(`families/${familyId}/transactions`).doc();
    batch.set(txRef, {
      ownerId: rule.ownerId,
      type: rule.type,
      name: rule.name,
      category: rule.category,
      customLabel: rule.customLabel,
      currency: rule.currency,
      amount: rule.amount,
      date: rule.nextDueDate,
      recurringRuleId: rule.id,
      description: "",
      visibility: rule.visibility,
      deleted: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.update(db.doc(`families/${familyId}/recurringRules/${rule.id}`), {
      nextDueDate: nextDueDateAfter(rule.nextDueDate, rule.frequency),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
    posted++;
  }
  return posted;
}
```

- [ ] **Step 2: Verify build + lint**

```bash
pnpm lint:fix && pnpm build
```

Expected: no NEW errors introduced by this file (the pre-existing income-related errors from Task 1 are still present and expected until Task 16).

- [ ] **Step 3: Commit**

```bash
git add src/lib/recurring.server.ts
git commit -m "feat(transactions): add RecurringRule Firestore helper and cron poster"
```

---

## Task 3: Firestore helper for transactions (`transactions.server.ts`)

**Files:**
- Create: `src/lib/transactions.server.ts`

**Interfaces:**
- Consumes: `getAdminDb()`; `canViewTransaction` from `@/lib/visibility`; `ExpenseCategory`, `IncomeCategory`, `Transaction`, `TransactionType`, `Visibility` from `@/types`.
- Produces:
  - `getTransactions(familyId: string, viewerUid: string, ownerId?: string): Promise<Transaction[]>`
  - `getTransaction(familyId: string, transactionId: string): Promise<Transaction | null>`
  - `createTransaction(familyId, ownerId, data): Promise<string>` where `data` is `{ type; name; category; customLabel: string | null; currency; amount; date: Date; description; visibility }`
  - `updateTransaction(familyId, transactionId, data: Partial<Pick<Transaction, "name" | "category" | "customLabel" | "currency" | "amount" | "date" | "description" | "visibility">>): Promise<void>`
  - `softDeleteTransaction(familyId, transactionId): Promise<void>`
  - `getCurrentMonthTransactions(familyId: string, viewerUid: string): Promise<Transaction[]>`

- [ ] **Step 1: Create the helper**

Create `src/lib/transactions.server.ts`:

```ts
import "server-only";

import { FieldValue, type Query } from "firebase-admin/firestore";
import { getAdminDb } from "@/firebase/admin";
import { canViewTransaction } from "@/lib/visibility";
import type {
  ExpenseCategory,
  IncomeCategory,
  Transaction,
  TransactionType,
  Visibility,
} from "@/types";

function docToTransaction(doc: FirebaseFirestore.DocumentSnapshot): Transaction {
  const d = doc.data();
  if (!d) throw new Error("Transaction doc empty");
  return {
    id: doc.id,
    ownerId: d.ownerId,
    type: d.type,
    name: d.name,
    category: d.category,
    customLabel: d.customLabel ?? null,
    currency: d.currency,
    amount: d.amount,
    date: d.date.toDate(),
    recurringRuleId: d.recurringRuleId ?? null,
    description: d.description ?? "",
    visibility: d.visibility ?? "shared",
    deleted: d.deleted ?? false,
    createdAt: d.createdAt.toDate(),
    updatedAt: d.updatedAt.toDate(),
  };
}

export async function getTransactions(
  familyId: string,
  viewerUid: string,
  ownerId?: string,
): Promise<Transaction[]> {
  let query: Query = getAdminDb()
    .collection(`families/${familyId}/transactions`)
    .where("deleted", "==", false)
    .orderBy("date", "desc");

  if (ownerId) query = query.where("ownerId", "==", ownerId);

  const snap = await query.get();
  return snap.docs.map(docToTransaction).filter((t) => canViewTransaction(t, viewerUid));
}

export async function getTransaction(
  familyId: string,
  transactionId: string,
): Promise<Transaction | null> {
  const snap = await getAdminDb().doc(`families/${familyId}/transactions/${transactionId}`).get();
  if (!snap.exists || snap.data()?.deleted) return null;
  return docToTransaction(snap);
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k as keyof T] = v as T[keyof T];
  }
  return out;
}

export async function createTransaction(
  familyId: string,
  ownerId: string,
  data: {
    type: TransactionType;
    name: string;
    category: IncomeCategory | ExpenseCategory;
    customLabel: string | null;
    currency: string;
    amount: number;
    date: Date;
    description: string;
    visibility: Visibility;
  },
): Promise<string> {
  const ref = getAdminDb().collection(`families/${familyId}/transactions`).doc();
  await ref.set({
    ...data,
    ownerId,
    recurringRuleId: null,
    deleted: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function updateTransaction(
  familyId: string,
  transactionId: string,
  data: Partial<
    Pick<
      Transaction,
      "name" | "category" | "customLabel" | "currency" | "amount" | "date" | "description" | "visibility"
    >
  >,
): Promise<void> {
  await getAdminDb()
    .doc(`families/${familyId}/transactions/${transactionId}`)
    .update({
      ...stripUndefined(data),
      updatedAt: FieldValue.serverTimestamp(),
    });
}

export async function softDeleteTransaction(
  familyId: string,
  transactionId: string,
): Promise<void> {
  await getAdminDb().doc(`families/${familyId}/transactions/${transactionId}`).update({
    deleted: true,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// Current-month transactions for the dashboard card (live per-viewer totals) —
// distinct from the stored MonthlySummary, which is the visibility-agnostic
// snapshot used for the multi-month trend chart. Queries by date range only
// (a single range filter, no composite index needed — see Global Constraints)
// and filters `deleted` + visibility in application code afterward.
export async function getCurrentMonthTransactions(
  familyId: string,
  viewerUid: string,
): Promise<Transaction[]> {
  const month = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const start = new Date(`${month}-01T00:00:00.000Z`);

  const snap = await getAdminDb()
    .collection(`families/${familyId}/transactions`)
    .where("date", ">=", start)
    .get();

  return snap.docs
    .map(docToTransaction)
    .filter((t) => !t.deleted && canViewTransaction(t, viewerUid));
}
```

- [ ] **Step 2: Verify build + lint**

```bash
pnpm lint:fix && pnpm build
```

Expected: no NEW errors introduced by this file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/transactions.server.ts
git commit -m "feat(transactions): add Transaction Firestore CRUD helper"
```

---

## Task 4: Monthly summary snapshot helper

**Files:**
- Create: `src/lib/monthly-summary.server.ts`

**Interfaces:**
- Consumes: `getAdminDb()`; `convertAmount` from `@/lib/currency`; `MonthlySummary` from `@/types`.
- Produces:
  - `recordMonthlySummary(familyId: string, month: string, baseCurrency: string, rates: Record<string, number>): Promise<void>`
  - `getMonthlySummaries(familyId: string, limit?: number): Promise<MonthlySummary[]>` (oldest → newest, default `limit = 12`)

- [ ] **Step 1: Create the helper**

Create `src/lib/monthly-summary.server.ts`:

```ts
import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/firebase/admin";
import { convertAmount } from "@/lib/currency";
import type { MonthlySummary } from "@/types";

// Sums that month's non-deleted transactions across ALL visibilities (private
// included) and upserts monthlySummaries/{month} — an objective family-wide
// total, same precedent as recordNetWorthSnapshot in networth.server.ts. The
// per-viewer visibility filter only applies to itemized reads (transaction
// lists/detail via getTransactions), never to this aggregate. Queries by date
// range only (no equality filter combined — see Global Constraints) and
// filters `deleted` in application code.
export async function recordMonthlySummary(
  familyId: string,
  month: string, // "YYYY-MM"
  baseCurrency: string,
  rates: Record<string, number>,
): Promise<void> {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  const snap = await getAdminDb()
    .collection(`families/${familyId}/transactions`)
    .where("date", ">=", start)
    .where("date", "<", end)
    .get();

  let totalIncomeBase = 0;
  let totalExpenseBase = 0;
  const byCategoryBase: Record<string, number> = {};

  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.deleted) continue;
    const amountBase = convertAmount(d.amount, d.currency, baseCurrency, rates);
    if (d.type === "income") totalIncomeBase += amountBase;
    else totalExpenseBase += amountBase;
    byCategoryBase[d.category] = (byCategoryBase[d.category] ?? 0) + amountBase;
  }

  await getAdminDb()
    .doc(`families/${familyId}/monthlySummaries/${month}`)
    .set({
      month,
      totalIncomeBase,
      totalExpenseBase,
      netBase: totalIncomeBase - totalExpenseBase,
      byCategoryBase,
      baseCurrency,
      recordedAt: FieldValue.serverTimestamp(),
    });
}

export async function getMonthlySummaries(
  familyId: string,
  limit = 12,
): Promise<MonthlySummary[]> {
  const snap = await getAdminDb()
    .collection(`families/${familyId}/monthlySummaries`)
    .orderBy("month", "desc")
    .limit(limit)
    .get();

  return snap.docs
    .map((doc) => {
      const d = doc.data();
      return {
        month: d.month,
        totalIncomeBase: d.totalIncomeBase ?? 0,
        totalExpenseBase: d.totalExpenseBase ?? 0,
        netBase: d.netBase ?? 0,
        byCategoryBase: d.byCategoryBase ?? {},
        baseCurrency: d.baseCurrency,
        recordedAt: d.recordedAt.toDate(),
      } satisfies MonthlySummary;
    })
    .reverse(); // oldest -> newest for charting
}
```

Note: `.where("date", ">=", start).where("date", "<", end)` is two range clauses on the *same* field (`date`), which is a single-field range query and does not require a composite index — only combining a range with an equality filter *on a different field* does (see Global Constraints).

- [ ] **Step 2: Verify build + lint**

```bash
pnpm lint:fix && pnpm build
```

Expected: no NEW errors introduced by this file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/monthly-summary.server.ts
git commit -m "feat(transactions): add monthly summary snapshot helper"
```

---

## Task 5: Activity types and query keys

**Files:**
- Modify: `src/lib/activity.server.ts`
- Modify: `src/lib/query/keys.ts`

**Interfaces:**
- Produces: `ActivityType` now includes `"transaction_added" | "transaction_updated" | "recurring_rule_added" | "recurring_rule_updated"` (no longer includes `"income_added" | "income_updated"`); `keys.transactions.{all,list,detail}`, `keys.recurringRules.{all,list,detail}`, `keys.monthlySummaries.list` (the `keys.income` block is removed).

- [ ] **Step 1: Update the activity type union**

In `src/lib/activity.server.ts`, replace:

```ts
export type ActivityType =
  | "asset_added"
  | "asset_updated"
  | "income_added"
  | "income_updated"
  | "loan_created"
  | "loan_updated"
  | "loan_deleted"
  | "repayment_made";
```

with:

```ts
export type ActivityType =
  | "asset_added"
  | "asset_updated"
  | "transaction_added"
  | "transaction_updated"
  | "recurring_rule_added"
  | "recurring_rule_updated"
  | "loan_created"
  | "loan_updated"
  | "loan_deleted"
  | "repayment_made";
```

- [ ] **Step 2: Replace the `income` query-key block**

In `src/lib/query/keys.ts`, replace:

```ts
  income: {
    all: (familyId: string) => ["income", familyId] as const,
    list: (familyId: string, owner?: string) =>
      ["income", familyId, "list", owner ?? null] as const,
    detail: (familyId: string, incomeId: string) =>
      ["income", familyId, "detail", incomeId] as const,
  },
```

with:

```ts
  transactions: {
    all: (familyId: string) => ["transactions", familyId] as const,
    list: (familyId: string, owner?: string) =>
      ["transactions", familyId, "list", owner ?? null] as const,
    detail: (familyId: string, transactionId: string) =>
      ["transactions", familyId, "detail", transactionId] as const,
  },
  recurringRules: {
    all: (familyId: string) => ["recurringRules", familyId] as const,
    list: (familyId: string, owner?: string) =>
      ["recurringRules", familyId, "list", owner ?? null] as const,
    detail: (familyId: string, ruleId: string) =>
      ["recurringRules", familyId, "detail", ruleId] as const,
  },
  monthlySummaries: {
    list: (familyId: string) => ["monthlySummaries", familyId, "list"] as const,
  },
```

- [ ] **Step 3: Verify build + lint**

```bash
pnpm lint:fix && pnpm build
```

Expected: the pre-existing income-file errors persist (unchanged path list); no NEW errors from these two files.

- [ ] **Step 4: Commit**

```bash
git add src/lib/activity.server.ts src/lib/query/keys.ts
git commit -m "feat(transactions): add activity types and query keys"
```

---

## Task 6: Recurring rule actions

**Files:**
- Create: `src/actions/recurring-rules.actions.ts`

**Interfaces:**
- Consumes: `createRecurringRule`, `getRecurringRule`, `softDeleteRecurringRule`, `updateRecurringRule` from `@/lib/recurring.server`; `canViewRecurringRule` from `@/lib/visibility`; `SUPPORTED_INCOME_CATEGORIES`, `SUPPORTED_EXPENSE_CATEGORIES` from `@/lib/cashflow`; `logActivity`, `deleteActivityForItem` from `@/lib/activity.server`; `requireUser` from `@/lib/auth.server`; `getFamilyForUser`, `getFamilyMembers` from `@/lib/family.server`; `formatCurrency` from `@/lib/currency.server`.
- Produces: `RecurringRuleFormState` type; `createRecurringRuleAction`, `updateRecurringRuleAction`, `deleteRecurringRuleAction`, `toggleRecurringRuleActiveAction(ruleId: string, active: boolean): Promise<void>`.

- [ ] **Step 1: Create the actions file**

Create `src/actions/recurring-rules.actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { deleteActivityForItem, logActivity } from "@/lib/activity.server";
import { requireUser } from "@/lib/auth.server";
import { SUPPORTED_EXPENSE_CATEGORIES, SUPPORTED_INCOME_CATEGORIES } from "@/lib/cashflow";
import { formatCurrency } from "@/lib/currency.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import {
  createRecurringRule,
  getRecurringRule,
  softDeleteRecurringRule,
  updateRecurringRule,
} from "@/lib/recurring.server";
import { canViewRecurringRule } from "@/lib/visibility";

export type RecurringRuleFormState = { errors?: Record<string, string[]> } | null;

const RecurringRuleSchema = z
  .object({
    type: z.enum(["income", "expense"]),
    name: z.string().min(1, "Name is required").max(100),
    category: z.enum([
      "salary",
      "bonus",
      "gift",
      "investment",
      "housing",
      "groceries",
      "utilities",
      "transport",
      "healthcare",
      "entertainment",
      "debt",
      "other",
    ]),
    customLabel: z.string().max(100).optional(),
    currency: z.string().length(3, "Invalid currency"),
    amount: z.coerce.number().positive("Amount must be positive"),
    frequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
    visibility: z.enum(["private", "shared"]).default("shared"),
  })
  .superRefine((d, ctx) => {
    const valid: readonly string[] =
      d.type === "income" ? SUPPORTED_INCOME_CATEGORIES : SUPPORTED_EXPENSE_CATEGORIES;
    if (!valid.includes(d.category)) {
      ctx.addIssue({
        code: "custom",
        path: ["category"],
        message: "Invalid category for this type",
      });
    }
    if (d.category === "other" && !d.customLabel) {
      ctx.addIssue({ code: "custom", path: ["customLabel"], message: "Label is required for Other" });
    }
  });

// customLabel is only meaningful when category === "other"; nulled otherwise so
// stale labels don't linger if the user later switches category.
function toRuleData(data: z.infer<typeof RecurringRuleSchema>) {
  return {
    type: data.type,
    name: data.name,
    category: data.category,
    customLabel: data.category === "other" ? (data.customLabel ?? null) : null,
    currency: data.currency,
    amount: data.amount,
    frequency: data.frequency,
    visibility: data.visibility,
  };
}

async function getContextOrThrow() {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) throw new Error("No family found");
  return { user, family };
}

async function assertCanMutate(familyId: string, ownerId: string, callerUid: string) {
  if (ownerId === callerUid) return;
  const members = await getFamilyMembers(familyId);
  const self = members.find((m) => m.uid === callerUid);
  if (self?.role !== "admin") throw new Error("Not authorized");
}

export async function createRecurringRuleAction(
  _prevState: RecurringRuleFormState,
  formData: FormData,
): Promise<RecurringRuleFormState> {
  const { user, family } = await getContextOrThrow();

  const members = await getFamilyMembers(family.id);
  if (members.find((m) => m.uid === user.uid)?.role === "viewer") {
    return { errors: { _: ["Viewers cannot add recurring rules"] } };
  }

  const parsed = RecurringRuleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const ruleData = toRuleData(parsed.data);
  const ruleId = await createRecurringRule(family.id, user.uid, ruleData);

  await logActivity(
    family.id,
    "recurring_rule_added",
    `Added recurring ${ruleData.type} "${ruleData.name}" (${formatCurrency(ruleData.amount, ruleData.currency)}/${ruleData.frequency})`,
    ruleData.visibility,
    ruleId,
  );

  revalidatePath("/transactions/recurring");
  revalidatePath("/transactions");
  redirect("/transactions/recurring");
}

export async function updateRecurringRuleAction(
  ruleId: string,
  _prevState: RecurringRuleFormState,
  formData: FormData,
): Promise<RecurringRuleFormState> {
  const { user, family } = await getContextOrThrow();

  const existing = await getRecurringRule(family.id, ruleId);
  if (!existing || !canViewRecurringRule(existing, user.uid)) {
    return { errors: { _: ["Recurring rule not found"] } };
  }

  await assertCanMutate(family.id, existing.ownerId, user.uid);

  const parsed = RecurringRuleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const ruleData = toRuleData(parsed.data);
  await updateRecurringRule(family.id, ruleId, ruleData);

  if (ruleData.visibility === "private") {
    await deleteActivityForItem(family.id, ruleId);
  } else {
    await logActivity(
      family.id,
      "recurring_rule_updated",
      `Updated recurring ${ruleData.type} "${ruleData.name}"`,
      ruleData.visibility,
      ruleId,
    );
  }

  revalidatePath("/transactions/recurring");
  revalidatePath("/transactions");
  redirect("/transactions/recurring");
}

export async function deleteRecurringRuleAction(ruleId: string): Promise<void> {
  const { user, family } = await getContextOrThrow();

  const existing = await getRecurringRule(family.id, ruleId);
  if (!existing || !canViewRecurringRule(existing, user.uid)) throw new Error("Not found");

  await assertCanMutate(family.id, existing.ownerId, user.uid);

  await softDeleteRecurringRule(family.id, ruleId);
  revalidatePath("/transactions/recurring");
  revalidatePath("/transactions");
  redirect("/transactions/recurring");
}

// Lightweight toggle for the pause/resume button — a full form resubmit would
// be overkill for flipping one boolean.
export async function toggleRecurringRuleActiveAction(
  ruleId: string,
  active: boolean,
): Promise<void> {
  const { user, family } = await getContextOrThrow();

  const existing = await getRecurringRule(family.id, ruleId);
  if (!existing || !canViewRecurringRule(existing, user.uid)) throw new Error("Not found");

  await assertCanMutate(family.id, existing.ownerId, user.uid);

  await updateRecurringRule(family.id, ruleId, { active });
  revalidatePath("/transactions/recurring");
}
```

- [ ] **Step 2: Verify build + lint**

```bash
pnpm lint:fix && pnpm build
```

Expected: no NEW errors introduced by this file.

- [ ] **Step 3: Commit**

```bash
git add src/actions/recurring-rules.actions.ts
git commit -m "feat(transactions): add recurring rule server actions"
```

---

## Task 7: Transaction actions

**Files:**
- Create: `src/actions/transactions.actions.ts`

**Interfaces:**
- Consumes: `createTransaction`, `getTransaction`, `softDeleteTransaction`, `updateTransaction` from `@/lib/transactions.server`; `canViewTransaction` from `@/lib/visibility`; `SUPPORTED_INCOME_CATEGORIES`, `SUPPORTED_EXPENSE_CATEGORIES` from `@/lib/cashflow`; `logActivity`, `deleteActivityForItem` from `@/lib/activity.server`; `requireUser` from `@/lib/auth.server`; `getFamilyForUser`, `getFamilyMembers` from `@/lib/family.server`; `formatCurrency` from `@/lib/currency.server`.
- Produces: `TransactionFormState` type; `createTransactionAction`, `updateTransactionAction`, `deleteTransactionAction`.

- [ ] **Step 1: Create the actions file**

Create `src/actions/transactions.actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { deleteActivityForItem, logActivity } from "@/lib/activity.server";
import { requireUser } from "@/lib/auth.server";
import { SUPPORTED_EXPENSE_CATEGORIES, SUPPORTED_INCOME_CATEGORIES } from "@/lib/cashflow";
import { formatCurrency } from "@/lib/currency.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import {
  createTransaction,
  getTransaction,
  softDeleteTransaction,
  updateTransaction,
} from "@/lib/transactions.server";
import { canViewTransaction } from "@/lib/visibility";

export type TransactionFormState = { errors?: Record<string, string[]> } | null;

const TransactionSchema = z
  .object({
    type: z.enum(["income", "expense"]),
    name: z.string().min(1, "Name is required").max(100),
    category: z.enum([
      "salary",
      "bonus",
      "gift",
      "investment",
      "housing",
      "groceries",
      "utilities",
      "transport",
      "healthcare",
      "entertainment",
      "debt",
      "other",
    ]),
    customLabel: z.string().max(100).optional(),
    currency: z.string().length(3, "Invalid currency"),
    amount: z.coerce.number().positive("Amount must be positive"),
    date: z.string().min(1, "Date is required"),
    description: z.string().max(500).optional().default(""),
    visibility: z.enum(["private", "shared"]).default("shared"),
  })
  .superRefine((d, ctx) => {
    const valid: readonly string[] =
      d.type === "income" ? SUPPORTED_INCOME_CATEGORIES : SUPPORTED_EXPENSE_CATEGORIES;
    if (!valid.includes(d.category)) {
      ctx.addIssue({
        code: "custom",
        path: ["category"],
        message: "Invalid category for this type",
      });
    }
    if (d.category === "other" && !d.customLabel) {
      ctx.addIssue({ code: "custom", path: ["customLabel"], message: "Label is required for Other" });
    }
  });

function toTransactionData(data: z.infer<typeof TransactionSchema>) {
  return {
    type: data.type,
    name: data.name,
    category: data.category,
    customLabel: data.category === "other" ? (data.customLabel ?? null) : null,
    currency: data.currency,
    amount: data.amount,
    date: new Date(data.date),
    description: data.description,
    visibility: data.visibility,
  };
}

async function getContextOrThrow() {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) throw new Error("No family found");
  return { user, family };
}

async function assertCanMutate(familyId: string, ownerId: string, callerUid: string) {
  if (ownerId === callerUid) return;
  const members = await getFamilyMembers(familyId);
  const self = members.find((m) => m.uid === callerUid);
  if (self?.role !== "admin") throw new Error("Not authorized");
}

export async function createTransactionAction(
  _prevState: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const { user, family } = await getContextOrThrow();

  const members = await getFamilyMembers(family.id);
  if (members.find((m) => m.uid === user.uid)?.role === "viewer") {
    return { errors: { _: ["Viewers cannot add transactions"] } };
  }

  const parsed = TransactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const txData = toTransactionData(parsed.data);
  const transactionId = await createTransaction(family.id, user.uid, txData);

  await logActivity(
    family.id,
    "transaction_added",
    `${txData.type === "income" ? "Added income" : "Added expense"} "${txData.name}" (${formatCurrency(txData.amount, txData.currency)})`,
    txData.visibility,
    transactionId,
  );

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  redirect(`/transactions/${transactionId}`);
}

export async function updateTransactionAction(
  transactionId: string,
  _prevState: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const { user, family } = await getContextOrThrow();

  const existing = await getTransaction(family.id, transactionId);
  if (!existing || !canViewTransaction(existing, user.uid)) {
    return { errors: { _: ["Transaction not found"] } };
  }

  await assertCanMutate(family.id, existing.ownerId, user.uid);

  const parsed = TransactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const txData = toTransactionData(parsed.data);
  await updateTransaction(family.id, transactionId, txData);

  if (txData.visibility === "private") {
    await deleteActivityForItem(family.id, transactionId);
  } else {
    await logActivity(
      family.id,
      "transaction_updated",
      `Updated "${txData.name}"`,
      txData.visibility,
      transactionId,
    );
  }

  revalidatePath("/transactions");
  revalidatePath(`/transactions/${transactionId}`);
  revalidatePath("/dashboard");
  redirect(`/transactions/${transactionId}`);
}

export async function deleteTransactionAction(transactionId: string): Promise<void> {
  const { user, family } = await getContextOrThrow();

  const existing = await getTransaction(family.id, transactionId);
  if (!existing || !canViewTransaction(existing, user.uid)) throw new Error("Not found");

  await assertCanMutate(family.id, existing.ownerId, user.uid);

  await softDeleteTransaction(family.id, transactionId);
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  redirect("/transactions");
}
```

- [ ] **Step 2: Verify build + lint**

```bash
pnpm lint:fix && pnpm build
```

Expected: no NEW errors introduced by this file.

- [ ] **Step 3: Commit**

```bash
git add src/actions/transactions.actions.ts
git commit -m "feat(transactions): add transaction server actions"
```

---

## Task 8: Recurring-transactions cron

**Files:**
- Create: `src/app/api/recurring-transactions/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `getAdminDb()` from `@/firebase/admin`; `getCachedRates` from `@/lib/currency.server`; `postDueRecurringTransactions` from `@/lib/recurring.server`; `recordMonthlySummary` from `@/lib/monthly-summary.server`.
- Produces: `GET` handler at `/api/recurring-transactions`, protected by `CRON_SECRET` (same pattern as `/api/fx-rates`).

- [ ] **Step 1: Create the cron route**

Create `src/app/api/recurring-transactions/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getAdminDb } from "@/firebase/admin";
import { getCachedRates } from "@/lib/currency.server";
import { recordMonthlySummary } from "@/lib/monthly-summary.server";
import { postDueRecurringTransactions } from "@/lib/recurring.server";

export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const month = new Date().toISOString().slice(0, 7);
  const db = getAdminDb();
  const familiesSnap = await db.collection("families").get();

  let posted = 0;
  let summarized = 0;
  await Promise.all(
    familiesSnap.docs.map(async (familyDoc) => {
      const settings = familyDoc.data().settings ?? {};
      const baseCurrency = settings.baseCurrency ?? "USD";
      try {
        posted += await postDueRecurringTransactions(familyDoc.id);

        const rates = await getCachedRates(familyDoc.id);
        await recordMonthlySummary(familyDoc.id, month, baseCurrency, rates);
        summarized++;
      } catch (err) {
        console.error(`recurring-transactions cron failed for family ${familyDoc.id}:`, err);
      }
    }),
  );

  return NextResponse.json({
    ok: true,
    month,
    familiesProcessed: familiesSnap.docs.length,
    posted,
    summarized,
  });
}
```

- [ ] **Step 2: Register the cron in `vercel.json`**

In `vercel.json`, add a new entry to the `crons` array (after `/api/reminders`):

```json
{
  "framework": "nextjs",
  "git": {
    "deploymentEnabled": false
  },
  "crons": [
    {
      "path": "/api/fx-rates",
      "schedule": "0 1 * * *"
    },
    {
      "path": "/api/reminders",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/recurring-transactions",
      "schedule": "0 3 * * *"
    }
  ]
}
```

- [ ] **Step 3: Verify build + lint**

```bash
pnpm lint:fix && pnpm build
```

Expected: no NEW errors introduced by these two files.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/recurring-transactions/route.ts vercel.json
git commit -m "feat(transactions): add recurring-transactions cron"
```

---

## Task 9: Route handlers for client refetches

**Files:**
- Create: `src/app/api/transactions/route.ts`
- Create: `src/app/api/transactions/[transactionId]/route.ts`
- Create: `src/app/api/recurring-rules/route.ts`
- Create: `src/app/api/recurring-rules/[ruleId]/route.ts`
- Create: `src/app/api/monthly-summaries/route.ts`

**Interfaces:**
- Consumes: `getRouteContext`, `isErrorResponse` from `@/lib/query/route-context.server`; `getTransactions`, `getTransaction` from `@/lib/transactions.server`; `getRecurringRules`, `getRecurringRule` from `@/lib/recurring.server`; `getMonthlySummaries` from `@/lib/monthly-summary.server`; `canViewTransaction`, `canViewRecurringRule` from `@/lib/visibility`.
- Produces: `GET /api/transactions`, `GET /api/transactions/[transactionId]`, `GET /api/recurring-rules`, `GET /api/recurring-rules/[ruleId]`, `GET /api/monthly-summaries`.

- [ ] **Step 1: Transactions list handler**

Create `src/app/api/transactions/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getRouteContext, isErrorResponse } from "@/lib/query/route-context.server";
import { getTransactions } from "@/lib/transactions.server";

// Client-data read for the transactions list. `getTransactions` enforces
// visibility (canViewTransaction) server-side, so private items never leave
// the server.
export async function GET(request: Request) {
  const ctx = await getRouteContext();
  if (isErrorResponse(ctx)) return ctx;

  const owner = new URL(request.url).searchParams.get("owner") ?? undefined;
  const transactions = await getTransactions(ctx.family.id, ctx.user.uid, owner);
  return NextResponse.json(transactions);
}
```

- [ ] **Step 2: Transaction detail handler**

Create `src/app/api/transactions/[transactionId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getRouteContext, isErrorResponse } from "@/lib/query/route-context.server";
import { getTransaction } from "@/lib/transactions.server";
import { canViewTransaction } from "@/lib/visibility";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ transactionId: string }> },
) {
  const ctx = await getRouteContext();
  if (isErrorResponse(ctx)) return ctx;

  const { transactionId } = await params;
  const transaction = await getTransaction(ctx.family.id, transactionId);
  if (!transaction || !canViewTransaction(transaction, ctx.user.uid)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(transaction);
}
```

- [ ] **Step 3: Recurring rules list handler**

Create `src/app/api/recurring-rules/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getRouteContext, isErrorResponse } from "@/lib/query/route-context.server";
import { getRecurringRules } from "@/lib/recurring.server";

export async function GET(request: Request) {
  const ctx = await getRouteContext();
  if (isErrorResponse(ctx)) return ctx;

  const owner = new URL(request.url).searchParams.get("owner") ?? undefined;
  const rules = await getRecurringRules(ctx.family.id, ctx.user.uid, owner);
  return NextResponse.json(rules);
}
```

- [ ] **Step 4: Recurring rule detail handler**

Create `src/app/api/recurring-rules/[ruleId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getRecurringRule } from "@/lib/recurring.server";
import { getRouteContext, isErrorResponse } from "@/lib/query/route-context.server";
import { canViewRecurringRule } from "@/lib/visibility";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ruleId: string }> },
) {
  const ctx = await getRouteContext();
  if (isErrorResponse(ctx)) return ctx;

  const { ruleId } = await params;
  const rule = await getRecurringRule(ctx.family.id, ruleId);
  if (!rule || !canViewRecurringRule(rule, ctx.user.uid)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(rule);
}
```

- [ ] **Step 5: Monthly summaries list handler**

Create `src/app/api/monthly-summaries/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getMonthlySummaries } from "@/lib/monthly-summary.server";
import { getRouteContext, isErrorResponse } from "@/lib/query/route-context.server";

export async function GET() {
  const ctx = await getRouteContext();
  if (isErrorResponse(ctx)) return ctx;

  const summaries = await getMonthlySummaries(ctx.family.id);
  return NextResponse.json(summaries);
}
```

- [ ] **Step 6: Verify build + lint**

```bash
pnpm lint:fix && pnpm build
```

Expected: no NEW errors introduced by these five files.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/transactions src/app/api/recurring-rules src/app/api/monthly-summaries
git commit -m "feat(transactions): add route handlers for client refetches"
```

---

## Task 10: Dashboard integration

**Files:**
- Modify: `src/lib/dashboard.server.ts`

**Interfaces:**
- Consumes: `getCurrentMonthTransactions` from `@/lib/transactions.server` (replaces `getIncomes` from `@/lib/income.server`; `monthlyEquivalent` from `@/lib/income` is no longer used here).
- Produces: `DashboardData` gains `monthlyExpenseTotal: number` and `monthlyNetTotal: number`; `monthlyIncomeTotal: number` is preserved (same field name, new data source) so `DashboardView.tsx` and the `dict.income.*` references there keep compiling unchanged until Task 16.

- [ ] **Step 1: Swap the imports**

In `src/lib/dashboard.server.ts`, replace:

```ts
import { monthlyEquivalent } from "@/lib/income";
import { getIncomes } from "@/lib/income.server";
```

with:

```ts
import { getCurrentMonthTransactions } from "@/lib/transactions.server";
```

- [ ] **Step 2: Add the new fields to `DashboardData`**

Replace:

```ts
export interface DashboardData {
  totalNetWorth: number;
  assetsTotal: number;
  receivablesTotal: number;
  liabilitiesTotal: number;
  monthlyIncomeTotal: number;
  memberSummaries: MemberSummary[];
  activeLoans: Loan[];
  overdueLoans: Loan[];
  recentAssets: Asset[];
  snapshots: NetWorthSnapshot[];
}
```

with:

```ts
export interface DashboardData {
  totalNetWorth: number;
  assetsTotal: number;
  receivablesTotal: number;
  liabilitiesTotal: number;
  monthlyIncomeTotal: number;
  monthlyExpenseTotal: number;
  monthlyNetTotal: number;
  memberSummaries: MemberSummary[];
  activeLoans: Loan[];
  overdueLoans: Loan[];
  recentAssets: Asset[];
  snapshots: NetWorthSnapshot[];
}
```

- [ ] **Step 3: Replace the income computation with a transaction-based one**

Replace:

```ts
  // Income is displayed alongside net worth but never summed into it.
  const income = await getIncomes(familyId, viewerUid);
  const monthlyIncomeTotal = income.reduce(
    (sum, i) =>
      sum +
      convertAmount(monthlyEquivalent(i.amount, i.frequency), i.currency, baseCurrency, rates),
    0,
  );

  return {
    totalNetWorth,
    assetsTotal,
    receivablesTotal,
    liabilitiesTotal,
    monthlyIncomeTotal,
    memberSummaries,
    activeLoans,
    overdueLoans,
    recentAssets,
    snapshots,
  };
```

with:

```ts
  // Transactions are displayed alongside net worth but never summed into it.
  const monthTransactions = await getCurrentMonthTransactions(familyId, viewerUid);
  let monthlyIncomeTotal = 0;
  let monthlyExpenseTotal = 0;
  for (const t of monthTransactions) {
    const amountBase = convertAmount(t.amount, t.currency, baseCurrency, rates);
    if (t.type === "income") monthlyIncomeTotal += amountBase;
    else monthlyExpenseTotal += amountBase;
  }
  const monthlyNetTotal = monthlyIncomeTotal - monthlyExpenseTotal;

  return {
    totalNetWorth,
    assetsTotal,
    receivablesTotal,
    liabilitiesTotal,
    monthlyIncomeTotal,
    monthlyExpenseTotal,
    monthlyNetTotal,
    memberSummaries,
    activeLoans,
    overdueLoans,
    recentAssets,
    snapshots,
  };
```

- [ ] **Step 4: Verify build + lint**

```bash
pnpm lint:fix && pnpm build
```

Expected: no NEW errors — `DashboardView.tsx` still compiles because `monthlyIncomeTotal` and `dict.income.monthlyIncome` both still exist at this point in the plan.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard.server.ts
git commit -m "feat(transactions): compute monthly income/expense/net from transactions"
```

---

## Task 11: i18n strings (additive)

**Files:**
- Modify: `src/lib/i18n/dictionaries.ts`

**Interfaces:**
- Produces: `Dictionary["transactions"]` (new block, added alongside the still-present `Dictionary["income"]`, which is removed in Task 16).

- [ ] **Step 1: Add `transactions` to the `Dictionary` interface**

In `src/lib/i18n/dictionaries.ts`, insert this block into the `Dictionary` interface immediately after the closing `};` of the `income: { ... };` block (the `income` block itself stays for now — it's removed in Task 16):

```ts
  transactions: {
    title: string;
    unitOne: string;
    unitOther: string;
    addTransaction: string;
    monthlyIncome: string;
    monthlyExpense: string;
    monthlyNet: string;
    noTransactionsTitle: string;
    noTransactionsDesc: string;
    noMatchTitle: string;
    noMatchDesc: string;
    name: string;
    amount: string;
    currency: string;
    type: string;
    typeIncome: string;
    typeExpense: string;
    category: string;
    customLabel: string;
    customLabelPlaceholder: string;
    date: string;
    owner: string;
    description: string;
    descriptionOptional: string;
    unknownOwner: string;
    addTitle: string;
    editTitle: string;
    createTransaction: string;
    delete: string;
    edit: string;
    deleteConfirm: string;
    privateLock: string;
    recurringBadge: string;
    trendTitle: string;
    trendEmpty: string;
    manageRecurring: string;
    categories: {
      salary: string;
      bonus: string;
      gift: string;
      investment: string;
      housing: string;
      groceries: string;
      utilities: string;
      transport: string;
      healthcare: string;
      entertainment: string;
      debt: string;
      other: string;
    };
    recurring: {
      title: string;
      addRule: string;
      frequency: string;
      frequencies: {
        weekly: string;
        monthly: string;
        quarterly: string;
        yearly: string;
      };
      active: string;
      paused: string;
      pause: string;
      resume: string;
      nextDue: string;
      noRulesTitle: string;
      noRulesDesc: string;
      addRuleTitle: string;
      editRuleTitle: string;
      createRule: string;
      delete: string;
      edit: string;
      deleteConfirm: string;
    };
  };
```

- [ ] **Step 2: Add the `en` values**

In the `en` dictionary, insert this block immediately after the `income: { ... },` block's closing `},`:

```ts
  transactions: {
    title: "Transactions",
    unitOne: "transaction",
    unitOther: "transactions",
    addTransaction: "+ Add transaction",
    monthlyIncome: "Income this month",
    monthlyExpense: "Expenses this month",
    monthlyNet: "Net cash flow",
    noTransactionsTitle: "No transactions yet",
    noTransactionsDesc: "Log income or an expense, or set up a recurring rule to track it here.",
    noMatchTitle: "No matching transactions",
    noMatchDesc: "Try adjusting your search or filters.",
    name: "Name",
    amount: "Amount",
    currency: "Currency",
    type: "Type",
    typeIncome: "Income",
    typeExpense: "Expense",
    category: "Category",
    customLabel: "Label",
    customLabelPlaceholder: "e.g. Piano lessons",
    date: "Date",
    owner: "Owner",
    description: "Description",
    descriptionOptional: "Description (optional)",
    unknownOwner: "Unknown",
    addTitle: "Add transaction",
    editTitle: "Edit transaction",
    createTransaction: "Add transaction",
    delete: "Delete",
    edit: "Edit",
    deleteConfirm: "Delete",
    privateLock: "Private — only visible to you",
    recurringBadge: "Recurring",
    trendTitle: "Income vs. expenses over time",
    trendEmpty: "Not enough history yet — check back after a couple of months.",
    manageRecurring: "Manage recurring",
    categories: {
      salary: "Salary",
      bonus: "Bonus",
      gift: "Gift",
      investment: "Investment",
      housing: "Housing",
      groceries: "Groceries",
      utilities: "Utilities",
      transport: "Transport",
      healthcare: "Healthcare",
      entertainment: "Entertainment",
      debt: "Debt payment",
      other: "Other",
    },
    recurring: {
      title: "Recurring rules",
      addRule: "+ Add recurring rule",
      frequency: "Frequency",
      frequencies: {
        weekly: "Weekly",
        monthly: "Monthly",
        quarterly: "Quarterly",
        yearly: "Yearly",
      },
      active: "Active",
      paused: "Paused",
      pause: "Pause",
      resume: "Resume",
      nextDue: "Next due",
      noRulesTitle: "No recurring rules yet",
      noRulesDesc: "Add a salary, rent, or subscription to auto-post it every period.",
      addRuleTitle: "Add recurring rule",
      editRuleTitle: "Edit recurring rule",
      createRule: "Add rule",
      delete: "Delete",
      edit: "Edit",
      deleteConfirm: "Delete",
    },
  },
```

- [ ] **Step 3: Add the `my` values**

In the `my` dictionary, insert this block immediately after the `income: { ... },` block's closing `},`:

```ts
  transactions: {
    title: "ငွေစာရင်း",
    unitOne: "မှတ်တမ်း",
    unitOther: "မှတ်တမ်းများ",
    addTransaction: "+ ငွေစာရင်း ထည့်ရန်",
    monthlyIncome: "ဒီလ ဝင်ငွေ",
    monthlyExpense: "ဒီလ အသုံးစရိတ်",
    monthlyNet: "အသားတင် ငွေစီးဆင်းမှု",
    noTransactionsTitle: "ငွေစာရင်း မရှိသေးပါ",
    noTransactionsDesc:
      "ဝင်ငွေ သို့မဟုတ် အသုံးစရိတ်တစ်ခု ထည့်ပါ၊ သို့မဟုတ် ပုံမှန်စည်းမျဉ်းတစ်ခု သတ်မှတ်ပါ။",
    noMatchTitle: "ကိုက်ညီသော ငွေစာရင်း မရှိပါ",
    noMatchDesc: "ရှာဖွေမှု သို့မဟုတ် စစ်ထုတ်မှုကို ပြောင်းကြည့်ပါ။",
    name: "အမည်",
    amount: "ပမာဏ",
    currency: "ငွေကြေး",
    type: "အမျိုးအစား",
    typeIncome: "ဝင်ငွေ",
    typeExpense: "အသုံးစရိတ်",
    category: "အမျိုးအစား",
    customLabel: "အမည်တံဆိပ်",
    customLabelPlaceholder: "ဥပမာ - စန္ဒရားသင်တန်း",
    date: "ရက်စွဲ",
    owner: "ပိုင်ရှင်",
    description: "ဖော်ပြချက်",
    descriptionOptional: "ဖော်ပြချက် (ရွေးချယ်နိုင်)",
    unknownOwner: "မသိရှိ",
    addTitle: "ငွေစာရင်း ထည့်ရန်",
    editTitle: "ငွေစာရင်း ပြင်ဆင်ရန်",
    createTransaction: "ငွေစာရင်း ထည့်ရန်",
    delete: "ဖျက်မည်",
    edit: "ပြင်မည်",
    deleteConfirm: "ဖျက်မှာသေချာပါသလား —",
    privateLock: "သီးသန့် — သင်သာ မြင်နိုင်သည်",
    recurringBadge: "ပုံမှန်",
    trendTitle: "ဝင်ငွေနှင့် အသုံးစရိတ် ခြေရာခံမှု",
    trendEmpty: "မှတ်တမ်း လုံလောက်မှု မရှိသေးပါ — နောက်လနှစ်လကြာမှ ပြန်စစ်ပါ။",
    manageRecurring: "ပုံမှန်စည်းမျဉ်းများ စီမံရန်",
    categories: {
      salary: "လစာ",
      bonus: "ဘောနပ်စ်",
      gift: "လက်ဆောင်",
      investment: "ရင်းနှီးမြှုပ်နှံမှု",
      housing: "အိမ်ခြံမြေ",
      groceries: "စျေးဝယ်စရိတ်",
      utilities: "လျှပ်စစ်/ရေ စရိတ်",
      transport: "ခရီးသွားစရိတ်",
      healthcare: "ကျန်းမာရေး",
      entertainment: "ဖျော်ဖြေရေး",
      debt: "အကြွေးပေးဆပ်ခြင်း",
      other: "အခြား",
    },
    recurring: {
      title: "ပုံမှန်စည်းမျဉ်းများ",
      addRule: "+ ပုံမှန်စည်းမျဉ်း ထည့်ရန်",
      frequency: "အကြိမ်ရေ",
      frequencies: {
        weekly: "အပတ်စဉ်",
        monthly: "လစဉ်",
        quarterly: "သုံးလတစ်ကြိမ်",
        yearly: "နှစ်စဉ်",
      },
      active: "လက်ရှိ",
      paused: "ခေတ္တရပ်ထား",
      pause: "ခေတ္တရပ်ရန်",
      resume: "ပြန်စရန်",
      nextDue: "နောက်ပေးရမည့်ရက်",
      noRulesTitle: "ပုံမှန်စည်းမျဉ်း မရှိသေးပါ",
      noRulesDesc: "လစာ၊ အိမ်ငှားခ သို့မဟုတ် subscription ထည့်၍ အလိုအလျောက် မှတ်တမ်းတင်ပါ။",
      addRuleTitle: "ပုံမှန်စည်းမျဉ်း ထည့်ရန်",
      editRuleTitle: "ပုံမှန်စည်းမျဉ်း ပြင်ဆင်ရန်",
      createRule: "စည်းမျဉ်း ထည့်ရန်",
      delete: "ဖျက်မည်",
      edit: "ပြင်မည်",
      deleteConfirm: "ဖျက်မှာသေချာပါသလား —",
    },
  },
```

- [ ] **Step 4: Verify build + lint**

```bash
pnpm lint:fix && pnpm build
```

Expected: no NEW errors — this step is purely additive to the `Dictionary` type and both locales.

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n/dictionaries.ts
git commit -m "feat(transactions): add i18n strings (en + my)"
```

---

## Task 12: Recurring rule UI

**Files:**
- Create: `src/components/transactions/RecurringRuleForm.tsx`
- Create: `src/components/transactions/RecurringRuleList.tsx`
- Create: `src/components/transactions/RecurringRulesView.tsx`
- Create: `src/components/transactions/DeleteRecurringRuleButton.tsx`
- Create: `src/components/transactions/PauseResumeButton.tsx`
- Create: `src/app/(dashboard)/transactions/recurring/page.tsx`
- Create: `src/app/(dashboard)/transactions/recurring/loading.tsx`
- Create: `src/app/(dashboard)/transactions/recurring/new/page.tsx`
- Create: `src/app/(dashboard)/transactions/recurring/[ruleId]/edit/page.tsx`

**Interfaces:**
- Consumes: `RecurringRuleFormState`, `createRecurringRuleAction`, `updateRecurringRuleAction`, `deleteRecurringRuleAction`, `toggleRecurringRuleActiveAction` from `@/actions/recurring-rules.actions`; `getRecurringRule`, `getRecurringRules` from `@/lib/recurring.server`; `canViewRecurringRule` from `@/lib/visibility`; `SUPPORTED_INCOME_CATEGORIES`, `SUPPORTED_EXPENSE_CATEGORIES`, `SUPPORTED_RECURRING_FREQUENCIES` from `@/lib/cashflow`; `SUPPORTED_CURRENCIES` from `@/lib/currency`; `keys.recurringRules` from `@/lib/query/keys`; `VisibilityField`, `EmptyState`, `PageSkeleton` from `@/components/ui/*`.
- Produces: `RecurringRuleForm`, `RecurringRuleList`, `RecurringRulesView`, `DeleteRecurringRuleButton`, `PauseResumeButton` components; the `/transactions/recurring`, `/transactions/recurring/new`, `/transactions/recurring/[ruleId]/edit` routes.

- [ ] **Step 1: Create `RecurringRuleForm.tsx`**

Create `src/components/transactions/RecurringRuleForm.tsx`:

```tsx
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
  const categories =
    type === "income" ? SUPPORTED_INCOME_CATEGORIES : SUPPORTED_EXPENSE_CATEGORIES;

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
```

- [ ] **Step 2: Create `RecurringRuleList.tsx`**

Create `src/components/transactions/RecurringRuleList.tsx`:

```tsx
import { ChevronRight, Lock, Repeat } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/currency";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { RecurringRule } from "@/types";

interface Props {
  rules: RecurringRule[];
  memberMap: Record<string, string>;
  dict: Dictionary;
}

export function RecurringRuleList({ rules, memberMap, dict }: Props) {
  if (rules.length === 0) {
    return (
      <EmptyState
        icon={Repeat}
        title={dict.transactions.recurring.noRulesTitle}
        description={dict.transactions.recurring.noRulesDesc}
        action={{ label: dict.transactions.recurring.addRule, href: "/transactions/recurring/new" }}
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {rules.map((rule) => (
        <Link key={rule.id} href={`/transactions/recurring/${rule.id}/edit`} className="block">
          <div className="card card-hover p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground truncate">{rule.name}</p>
                <span className="hidden sm:inline shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent-soft text-accent-strong">
                  {dict.transactions.recurring.frequencies[rule.frequency]}
                </span>
                {!rule.active && (
                  <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-foreground/8 text-muted">
                    {dict.transactions.recurring.paused}
                  </span>
                )}
                {rule.visibility === "private" && (
                  <Lock
                    className="shrink-0 w-3.5 h-3.5 text-muted/70"
                    aria-label={dict.transactions.privateLock}
                  />
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted truncate">
                {memberMap[rule.ownerId] ?? dict.transactions.unknownOwner} ·{" "}
                {dict.transactions.recurring.nextDue}: {rule.nextDueDate.toLocaleDateString()}
              </p>
            </div>

            <p
              className={`font-semibold tabular-nums shrink-0 ${
                rule.type === "income" ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {rule.type === "income" ? "+" : "−"}
              {formatCurrency(rule.amount, rule.currency)}
            </p>

            <ChevronRight className="w-4 h-4 text-muted/60 shrink-0" aria-hidden="true" />
          </div>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create `RecurringRulesView.tsx`**

Create `src/components/transactions/RecurringRulesView.tsx`:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo } from "react";
import { RecurringRuleList } from "@/components/transactions/RecurringRuleList";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fetchJson } from "@/lib/query/fetch-json";
import { keys } from "@/lib/query/keys";
import type { FamilyMember, RecurringRule } from "@/types";

interface Props {
  familyId: string;
  members: FamilyMember[];
  dict: Dictionary;
}

export function RecurringRulesView({ familyId, members, dict }: Props) {
  const { data: rules = [] } = useQuery({
    queryKey: keys.recurringRules.list(familyId),
    queryFn: () => fetchJson<RecurringRule[]>("/api/recurring-rules"),
  });

  const memberMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.uid, m.displayName])),
    [members],
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          {dict.transactions.recurring.title}
        </h1>
        <Link href="/transactions/recurring/new" className="btn-primary shrink-0">
          {dict.transactions.recurring.addRule}
        </Link>
      </div>
      <RecurringRuleList rules={rules} memberMap={memberMap} dict={dict} />
    </div>
  );
}
```

- [ ] **Step 4: Create `DeleteRecurringRuleButton.tsx` and `PauseResumeButton.tsx`**

Create `src/components/transactions/DeleteRecurringRuleButton.tsx`:

```tsx
"use client";

import { deleteRecurringRuleAction } from "@/actions/recurring-rules.actions";
import { useI18n } from "@/components/i18n/I18nProvider";

export function DeleteRecurringRuleButton({ ruleId, label }: { ruleId: string; label: string }) {
  const { dict } = useI18n();
  const action = deleteRecurringRuleAction.bind(null, ruleId);

  return (
    <form action={action}>
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm(`${dict.transactions.recurring.deleteConfirm} ${label}?`)) e.preventDefault();
        }}
        className="text-sm text-red-500 hover:text-red-700"
      >
        {dict.transactions.recurring.delete}
      </button>
    </form>
  );
}
```

Create `src/components/transactions/PauseResumeButton.tsx`:

```tsx
"use client";

import { toggleRecurringRuleActiveAction } from "@/actions/recurring-rules.actions";
import { useI18n } from "@/components/i18n/I18nProvider";

export function PauseResumeButton({ ruleId, active }: { ruleId: string; active: boolean }) {
  const { dict } = useI18n();
  const action = toggleRecurringRuleActiveAction.bind(null, ruleId, !active);

  return (
    <form action={action}>
      <button type="submit" className="text-sm text-accent hover:underline">
        {active ? dict.transactions.recurring.pause : dict.transactions.recurring.resume}
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Create the recurring rules pages**

Create `src/app/(dashboard)/transactions/recurring/page.tsx`:

```tsx
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { RecurringRulesView } from "@/components/transactions/RecurringRulesView";
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getServerI18n } from "@/lib/i18n/server";
import { getQueryClient } from "@/lib/query/get-query-client";
import { keys } from "@/lib/query/keys";
import { getRecurringRules } from "@/lib/recurring.server";

export default async function RecurringRulesPage() {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const queryClient = getQueryClient();
  const [members, { dict }] = await Promise.all([
    getFamilyMembers(family.id),
    getServerI18n(),
    queryClient.prefetchQuery({
      queryKey: keys.recurringRules.list(family.id),
      queryFn: () => getRecurringRules(family.id, user.uid),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RecurringRulesView familyId={family.id} members={members} dict={dict} />
    </HydrationBoundary>
  );
}
```

Create `src/app/(dashboard)/transactions/recurring/loading.tsx`:

```tsx
import { PageSkeleton } from "@/components/ui/Skeleton";

export default function RecurringRulesLoading() {
  return (
    <div className="max-w-4xl mx-auto">
      <PageSkeleton rows={4} />
    </div>
  );
}
```

Create `src/app/(dashboard)/transactions/recurring/new/page.tsx`:

```tsx
import { createRecurringRuleAction } from "@/actions/recurring-rules.actions";
import { RecurringRuleForm } from "@/components/transactions/RecurringRuleForm";
import { getServerI18n } from "@/lib/i18n/server";

export default async function NewRecurringRulePage() {
  const { dict } = await getServerI18n();
  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold text-foreground mb-6">
        {dict.transactions.recurring.addRuleTitle}
      </h1>
      <RecurringRuleForm
        action={createRecurringRuleAction}
        submitLabel={dict.transactions.recurring.createRule}
      />
    </div>
  );
}
```

Create `src/app/(dashboard)/transactions/recurring/[ruleId]/edit/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import { updateRecurringRuleAction } from "@/actions/recurring-rules.actions";
import { DeleteRecurringRuleButton } from "@/components/transactions/DeleteRecurringRuleButton";
import { PauseResumeButton } from "@/components/transactions/PauseResumeButton";
import { RecurringRuleForm } from "@/components/transactions/RecurringRuleForm";
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getServerI18n } from "@/lib/i18n/server";
import { getRecurringRule } from "@/lib/recurring.server";
import { canViewRecurringRule } from "@/lib/visibility";

export default async function EditRecurringRulePage({
  params,
}: {
  params: Promise<{ ruleId: string }>;
}) {
  const { ruleId } = await params;
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const rule = await getRecurringRule(family.id, ruleId);
  if (!rule || !canViewRecurringRule(rule, user.uid)) notFound();

  const members = await getFamilyMembers(family.id);
  const self = members.find((m) => m.uid === user.uid);
  const canMutate = rule.ownerId === user.uid || self?.role === "admin";
  if (!canMutate) redirect("/transactions/recurring");

  const boundAction = updateRecurringRuleAction.bind(null, rule.id);
  const { dict } = await getServerI18n();

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">
          {dict.transactions.recurring.editRuleTitle}
        </h1>
        <div className="flex items-center gap-3">
          <PauseResumeButton ruleId={rule.id} active={rule.active} />
          <DeleteRecurringRuleButton ruleId={rule.id} label={rule.name} />
        </div>
      </div>
      <RecurringRuleForm
        action={boundAction}
        defaultValues={rule}
        submitLabel={dict.common.saveChanges}
      />
    </div>
  );
}
```

- [ ] **Step 6: Verify build + lint**

```bash
pnpm lint:fix && pnpm build
```

Expected: no NEW errors introduced by these nine files.

- [ ] **Step 7: Commit**

```bash
git add src/components/transactions/RecurringRuleForm.tsx src/components/transactions/RecurringRuleList.tsx src/components/transactions/RecurringRulesView.tsx src/components/transactions/DeleteRecurringRuleButton.tsx src/components/transactions/PauseResumeButton.tsx "src/app/(dashboard)/transactions/recurring"
git commit -m "feat(transactions): add recurring rule management UI"
```

---

## Task 13: Transaction create/edit UI

**Files:**
- Create: `src/components/transactions/TransactionForm.tsx`
- Create: `src/app/(dashboard)/transactions/new/page.tsx`
- Create: `src/app/(dashboard)/transactions/[transactionId]/edit/page.tsx`

**Interfaces:**
- Consumes: `TransactionFormState`, `createTransactionAction`, `updateTransactionAction` from `@/actions/transactions.actions`; `getTransaction` from `@/lib/transactions.server`; `canViewTransaction` from `@/lib/visibility`; `SUPPORTED_INCOME_CATEGORIES`, `SUPPORTED_EXPENSE_CATEGORIES` from `@/lib/cashflow`; `SUPPORTED_CURRENCIES` from `@/lib/currency`.
- Produces: `TransactionForm` component; the `/transactions/new` and `/transactions/[transactionId]/edit` routes.

- [ ] **Step 1: Create `TransactionForm.tsx`**

Create `src/components/transactions/TransactionForm.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import type { TransactionFormState } from "@/actions/transactions.actions";
import { useI18n } from "@/components/i18n/I18nProvider";
import { VisibilityField } from "@/components/ui/VisibilityField";
import { SUPPORTED_EXPENSE_CATEGORIES, SUPPORTED_INCOME_CATEGORIES } from "@/lib/cashflow";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import type { ExpenseCategory, IncomeCategory, Transaction, TransactionType } from "@/types";

interface Props {
  action: (prevState: TransactionFormState, formData: FormData) => Promise<TransactionFormState>;
  defaultValues?: Partial<Transaction>;
  submitLabel?: string;
}

function toDateInput(date?: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

export function TransactionForm({ action, defaultValues, submitLabel }: Props) {
  const { dict } = useI18n();
  const [state, formAction, pending] = useActionState<TransactionFormState, FormData>(
    action,
    null,
  );
  const [type, setType] = useState<TransactionType>(defaultValues?.type ?? "expense");
  const [category, setCategory] = useState<IncomeCategory | ExpenseCategory>(
    defaultValues?.category ?? (type === "income" ? "salary" : "housing"),
  );
  const categories =
    type === "income" ? SUPPORTED_INCOME_CATEGORIES : SUPPORTED_EXPENSE_CATEGORIES;

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
        <label htmlFor="tx-name" className="block text-sm font-medium text-foreground/80 mb-1">
          {dict.transactions.name}
        </label>
        <input
          id="tx-name"
          name="name"
          defaultValue={defaultValues?.name}
          required
          className="w-full px-4 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-soft"
        />
        {state?.errors?.name && <p className="text-sm text-red-500 mt-1">{state.errors.name[0]}</p>}
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="tx-amount" className="block text-sm font-medium text-foreground/80 mb-1">
            {dict.transactions.amount}
          </label>
          <input
            id="tx-amount"
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
            htmlFor="tx-currency"
            className="block text-sm font-medium text-foreground/80 mb-1"
          >
            {dict.transactions.currency}
          </label>
          <select
            id="tx-currency"
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
        <label htmlFor="tx-date" className="block text-sm font-medium text-foreground/80 mb-1">
          {dict.transactions.date}
        </label>
        <input
          id="tx-date"
          name="date"
          type="date"
          defaultValue={toDateInput(defaultValues?.date)}
          required
          className="w-full px-4 py-2 border border-line rounded-lg"
        />
        {state?.errors?.date && <p className="text-sm text-red-500 mt-1">{state.errors.date[0]}</p>}
      </div>

      <div>
        <label
          htmlFor="tx-category"
          className="block text-sm font-medium text-foreground/80 mb-1"
        >
          {dict.transactions.category}
        </label>
        <select
          id="tx-category"
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
            htmlFor="tx-custom-label"
            className="block text-sm font-medium text-foreground/80 mb-1"
          >
            {dict.transactions.customLabel}
          </label>
          <input
            id="tx-custom-label"
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

      <div>
        <label
          htmlFor="tx-description"
          className="block text-sm font-medium text-foreground/80 mb-1"
        >
          {dict.transactions.descriptionOptional}
        </label>
        <textarea
          id="tx-description"
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
        {pending ? dict.common.saving : (submitLabel ?? dict.transactions.createTransaction)}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create the new/edit pages**

Create `src/app/(dashboard)/transactions/new/page.tsx`:

```tsx
import { createTransactionAction } from "@/actions/transactions.actions";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { getServerI18n } from "@/lib/i18n/server";

export default async function NewTransactionPage() {
  const { dict } = await getServerI18n();
  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold text-foreground mb-6">{dict.transactions.addTitle}</h1>
      <TransactionForm
        action={createTransactionAction}
        submitLabel={dict.transactions.createTransaction}
      />
    </div>
  );
}
```

Create `src/app/(dashboard)/transactions/[transactionId]/edit/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import { updateTransactionAction } from "@/actions/transactions.actions";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getServerI18n } from "@/lib/i18n/server";
import { getTransaction } from "@/lib/transactions.server";
import { canViewTransaction } from "@/lib/visibility";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const { transactionId } = await params;
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const transaction = await getTransaction(family.id, transactionId);
  if (!transaction || !canViewTransaction(transaction, user.uid)) notFound();

  const members = await getFamilyMembers(family.id);
  const self = members.find((m) => m.uid === user.uid);
  const canMutate = transaction.ownerId === user.uid || self?.role === "admin";
  if (!canMutate) redirect(`/transactions/${transaction.id}`);

  const boundAction = updateTransactionAction.bind(null, transaction.id);
  const { dict } = await getServerI18n();

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold text-foreground mb-6">
        {dict.transactions.editTitle}
      </h1>
      <TransactionForm
        action={boundAction}
        defaultValues={transaction}
        submitLabel={dict.common.saveChanges}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify build + lint**

```bash
pnpm lint:fix && pnpm build
```

Expected: no NEW errors introduced by these three files.

- [ ] **Step 4: Commit**

```bash
git add src/components/transactions/TransactionForm.tsx "src/app/(dashboard)/transactions/new" "src/app/(dashboard)/transactions/[transactionId]/edit"
git commit -m "feat(transactions): add transaction create/edit UI"
```

---

## Task 14: Transaction detail UI

**Files:**
- Create: `src/components/transactions/DeleteTransactionButton.tsx`
- Create: `src/components/transactions/TransactionDetailView.tsx`
- Create: `src/app/(dashboard)/transactions/[transactionId]/page.tsx`

**Interfaces:**
- Consumes: `deleteTransactionAction` from `@/actions/transactions.actions`; `getTransaction` from `@/lib/transactions.server`; `canViewTransaction` from `@/lib/visibility`; `VisibilityBadge` from `@/components/ui/VisibilityBadge`; `keys.transactions.detail` from `@/lib/query/keys`.
- Produces: `DeleteTransactionButton`, `TransactionDetailView` components; the `/transactions/[transactionId]` route.

- [ ] **Step 1: Create `DeleteTransactionButton.tsx`**

Create `src/components/transactions/DeleteTransactionButton.tsx`:

```tsx
"use client";

import { deleteTransactionAction } from "@/actions/transactions.actions";
import { useI18n } from "@/components/i18n/I18nProvider";

export function DeleteTransactionButton({
  transactionId,
  label,
}: {
  transactionId: string;
  label: string;
}) {
  const { dict } = useI18n();
  const action = deleteTransactionAction.bind(null, transactionId);

  return (
    <form action={action}>
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm(`${dict.transactions.deleteConfirm} ${label}?`)) e.preventDefault();
        }}
        className="text-sm text-red-500 hover:text-red-700"
      >
        {dict.transactions.delete}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create `TransactionDetailView.tsx`**

Create `src/components/transactions/TransactionDetailView.tsx`:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { DeleteTransactionButton } from "@/components/transactions/DeleteTransactionButton";
import { VisibilityBadge } from "@/components/ui/VisibilityBadge";
import { formatCurrency } from "@/lib/currency";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fetchJson } from "@/lib/query/fetch-json";
import { keys } from "@/lib/query/keys";
import type { Transaction } from "@/types";

interface Props {
  familyId: string;
  transactionId: string;
  ownerName: string;
  canMutate: boolean;
  dict: Dictionary;
}

export function TransactionDetailView({
  familyId,
  transactionId,
  ownerName,
  canMutate,
  dict,
}: Props) {
  const { data: transaction } = useQuery({
    queryKey: keys.transactions.detail(familyId, transactionId),
    queryFn: () => fetchJson<Transaction>(`/api/transactions/${transactionId}`),
  });

  if (!transaction) return null;

  const categoryLabel =
    transaction.category === "other" && transaction.customLabel
      ? transaction.customLabel
      : dict.transactions.categories[transaction.category];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-foreground">{transaction.name}</h1>
          <VisibilityBadge visibility={transaction.visibility} />
        </div>
        {canMutate && (
          <div className="flex items-center gap-3">
            <Link
              href={`/transactions/${transaction.id}/edit`}
              className="text-sm text-accent hover:underline"
            >
              {dict.transactions.edit}
            </Link>
            <DeleteTransactionButton transactionId={transaction.id} label={transaction.name} />
          </div>
        )}
      </div>

      <dl className="bg-card rounded-xl border border-line divide-y divide-line">
        <Row label={dict.transactions.type}>
          {transaction.type === "income"
            ? dict.transactions.typeIncome
            : dict.transactions.typeExpense}
        </Row>
        <Row label={dict.transactions.amount}>
          <span className="font-semibold">
            {formatCurrency(transaction.amount, transaction.currency)}
          </span>
        </Row>
        <Row label={dict.transactions.category}>{categoryLabel}</Row>
        <Row label={dict.transactions.date}>{transaction.date.toLocaleDateString()}</Row>
        {transaction.recurringRuleId && (
          <Row label={dict.transactions.recurringBadge}>
            <Link
              href={`/transactions/recurring/${transaction.recurringRuleId}/edit`}
              className="text-accent hover:underline"
            >
              {dict.transactions.recurring.title}
            </Link>
          </Row>
        )}
        <Row label={dict.transactions.owner}>{ownerName}</Row>
        {transaction.description && (
          <Row label={dict.transactions.description}>{transaction.description}</Row>
        )}
      </dl>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 px-4 py-3 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-foreground text-right">{children}</dd>
    </div>
  );
}
```

- [ ] **Step 3: Create the detail page**

Create `src/app/(dashboard)/transactions/[transactionId]/page.tsx`:

```tsx
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { TransactionDetailView } from "@/components/transactions/TransactionDetailView";
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getServerI18n } from "@/lib/i18n/server";
import { getQueryClient } from "@/lib/query/get-query-client";
import { keys } from "@/lib/query/keys";
import { getTransaction } from "@/lib/transactions.server";
import { canViewTransaction } from "@/lib/visibility";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const { transactionId } = await params;
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const transaction = await getTransaction(family.id, transactionId);
  if (!transaction || !canViewTransaction(transaction, user.uid)) notFound();

  const [members, { dict }] = await Promise.all([getFamilyMembers(family.id), getServerI18n()]);

  const queryClient = getQueryClient();
  queryClient.setQueryData(keys.transactions.detail(family.id, transactionId), transaction);

  const owner = members.find((m) => m.uid === transaction.ownerId);
  const self = members.find((m) => m.uid === user.uid);
  const canMutate = transaction.ownerId === user.uid || self?.role === "admin";

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TransactionDetailView
        familyId={family.id}
        transactionId={transactionId}
        ownerName={owner?.displayName ?? dict.transactions.unknownOwner}
        canMutate={canMutate}
        dict={dict}
      />
    </HydrationBoundary>
  );
}
```

- [ ] **Step 4: Verify build + lint**

```bash
pnpm lint:fix && pnpm build
```

Expected: no NEW errors introduced by these three files.

- [ ] **Step 5: Commit**

```bash
git add src/components/transactions/DeleteTransactionButton.tsx src/components/transactions/TransactionDetailView.tsx "src/app/(dashboard)/transactions/[transactionId]/page.tsx"
git commit -m "feat(transactions): add transaction detail UI"
```

---

## Task 15: Transaction list, trend chart, and main page

**Files:**
- Create: `src/components/transactions/TransactionList.tsx`
- Create: `src/components/transactions/CashflowTrend.tsx`
- Create: `src/components/transactions/TransactionsView.tsx`
- Create: `src/app/(dashboard)/transactions/page.tsx`
- Create: `src/app/(dashboard)/transactions/loading.tsx`
- Create: `src/app/(dashboard)/transactions/error.tsx`

**Interfaces:**
- Consumes: `getTransactions` from `@/lib/transactions.server`; `getMonthlySummaries` from `@/lib/monthly-summary.server`; `getCachedRates` from `@/lib/currency.server`; `convertAmount`, `formatCurrency` from `@/lib/currency`; `keys.transactions.list`, `keys.monthlySummaries.list` from `@/lib/query/keys`; `plural` from `@/lib/i18n/dictionaries`.
- Produces: `TransactionList`, `CashflowTrend`, `TransactionsView` components; the `/transactions` route (list page, loading, error).

- [ ] **Step 1: Create `TransactionList.tsx`**

Create `src/components/transactions/TransactionList.tsx`:

```tsx
import { ChevronRight, Lock, Repeat } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/currency";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Transaction } from "@/types";

interface Props {
  transactions: Transaction[];
  memberMap: Record<string, string>;
  dict: Dictionary;
  filtered?: boolean;
}

export function TransactionList({ transactions, memberMap, dict, filtered }: Props) {
  if (transactions.length === 0) {
    return filtered ? (
      <EmptyState
        icon={Repeat}
        title={dict.transactions.noMatchTitle}
        description={dict.transactions.noMatchDesc}
      />
    ) : (
      <EmptyState
        icon={Repeat}
        title={dict.transactions.noTransactionsTitle}
        description={dict.transactions.noTransactionsDesc}
        action={{ label: dict.transactions.addTransaction, href: "/transactions/new" }}
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {transactions.map((t) => (
        <Link key={t.id} href={`/transactions/${t.id}`} className="block">
          <div className="card card-hover p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground truncate">{t.name}</p>
                <span className="hidden sm:inline shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent-soft text-accent-strong">
                  {t.category === "other" && t.customLabel
                    ? t.customLabel
                    : dict.transactions.categories[t.category]}
                </span>
                {t.recurringRuleId && (
                  <Repeat
                    className="shrink-0 w-3.5 h-3.5 text-muted/70"
                    aria-label={dict.transactions.recurringBadge}
                  />
                )}
                {t.visibility === "private" && (
                  <Lock
                    className="shrink-0 w-3.5 h-3.5 text-muted/70"
                    aria-label={dict.transactions.privateLock}
                  />
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted truncate">
                {memberMap[t.ownerId] ?? dict.transactions.unknownOwner} ·{" "}
                {t.date.toLocaleDateString()}
              </p>
            </div>

            <p
              className={`font-semibold tabular-nums shrink-0 ${
                t.type === "income" ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {t.type === "income" ? "+" : "−"}
              {formatCurrency(t.amount, t.currency)}
            </p>

            <ChevronRight className="w-4 h-4 text-muted/60 shrink-0" aria-hidden="true" />
          </div>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `CashflowTrend.tsx`**

Create `src/components/transactions/CashflowTrend.tsx`:

```tsx
"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { MonthlySummary } from "@/types";

interface Props {
  summaries: MonthlySummary[];
  currency: string;
}

export function CashflowTrend({ summaries, currency }: Props) {
  const { dict } = useI18n();

  if (summaries.length < 2) {
    return <p className="text-muted text-sm">{dict.transactions.trendEmpty}</p>;
  }

  const data = summaries.map((s) => ({
    month: s.month.slice(5), // MM
    income: s.totalIncomeBase,
    expense: s.totalExpenseBase,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="cfIncomeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="cfExpenseGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="month" tick={{ fontSize: 11 }} minTickGap={24} />
        <YAxis
          tick={{ fontSize: 11 }}
          width={56}
          tickFormatter={(v) =>
            new Intl.NumberFormat("en-US", {
              notation: "compact",
              currency,
              style: "currency",
            }).format(v)
          }
        />
        <Tooltip
          formatter={(value) =>
            new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(value))
          }
        />
        <Area
          type="monotone"
          dataKey="income"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#cfIncomeGradient)"
        />
        <Area
          type="monotone"
          dataKey="expense"
          stroke="#ef4444"
          strokeWidth={2}
          fill="url(#cfExpenseGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 3: Create `TransactionsView.tsx`**

Create `src/components/transactions/TransactionsView.tsx`:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { CashflowTrend } from "@/components/transactions/CashflowTrend";
import { TransactionList } from "@/components/transactions/TransactionList";
import { convertAmount, formatCurrency } from "@/lib/currency";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { plural } from "@/lib/i18n/dictionaries";
import { fetchJson } from "@/lib/query/fetch-json";
import { keys } from "@/lib/query/keys";
import type { FamilyMember, MonthlySummary, Transaction } from "@/types";

interface Props {
  familyId: string;
  baseCurrency: string;
  rates: Record<string, number>;
  members: FamilyMember[];
  dict: Dictionary;
}

export function TransactionsView({ familyId, baseCurrency, rates, members, dict }: Props) {
  const { data: transactions = [] } = useQuery({
    queryKey: keys.transactions.list(familyId),
    queryFn: () => fetchJson<Transaction[]>("/api/transactions"),
  });
  const { data: summaries = [] } = useQuery({
    queryKey: keys.monthlySummaries.list(familyId),
    queryFn: () => fetchJson<MonthlySummary[]>("/api/monthly-summaries"),
  });

  const memberMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.uid, m.displayName])),
    [members],
  );

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthTransactions = transactions.filter(
    (t) => t.date.toISOString().slice(0, 7) === currentMonth,
  );
  const monthlyIncome = monthTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + convertAmount(t.amount, t.currency, baseCurrency, rates), 0);
  const monthlyExpense = monthTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + convertAmount(t.amount, t.currency, baseCurrency, rates), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {dict.transactions.title}
          </h1>
          <p className="text-sm text-muted mt-1">
            {transactions.length}{" "}
            {plural(transactions.length, dict.transactions.unitOne, dict.transactions.unitOther)} ·{" "}
            {baseCurrency}
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <Link
            href="/transactions/recurring"
            className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium border border-line text-foreground/80 hover:bg-foreground/4"
          >
            {dict.transactions.manageRecurring}
          </Link>
          <Link href="/transactions/new" className="btn-primary">
            {dict.transactions.addTransaction}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted">{dict.transactions.monthlyIncome}</p>
            <p className="text-2xl font-bold text-foreground mt-1 tracking-tight tabular-nums">
              {formatCurrency(monthlyIncome, baseCurrency)}
            </p>
          </div>
          <span className="icon-chip">
            <ArrowUpRight className="w-5 h-5" aria-hidden="true" />
          </span>
        </div>
        <div className="card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted">{dict.transactions.monthlyExpense}</p>
            <p className="text-2xl font-bold text-foreground mt-1 tracking-tight tabular-nums">
              {formatCurrency(monthlyExpense, baseCurrency)}
            </p>
          </div>
          <span className="icon-chip">
            <ArrowDownLeft className="w-5 h-5" aria-hidden="true" />
          </span>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <span className="icon-chip">
            <Wallet className="w-5 h-5" aria-hidden="true" />
          </span>
          <h2 className="font-semibold text-foreground">{dict.transactions.trendTitle}</h2>
        </div>
        <CashflowTrend summaries={summaries} currency={baseCurrency} />
      </div>

      <TransactionList transactions={transactions} memberMap={memberMap} dict={dict} />
    </div>
  );
}
```

- [ ] **Step 4: Create the main list page, loading, and error states**

Create `src/app/(dashboard)/transactions/page.tsx`:

```tsx
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { TransactionsView } from "@/components/transactions/TransactionsView";
import { requireUser } from "@/lib/auth.server";
import { getCachedRates } from "@/lib/currency.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getServerI18n } from "@/lib/i18n/server";
import { getMonthlySummaries } from "@/lib/monthly-summary.server";
import { getQueryClient } from "@/lib/query/get-query-client";
import { keys } from "@/lib/query/keys";
import { getTransactions } from "@/lib/transactions.server";

export default async function TransactionsPage() {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const queryClient = getQueryClient();
  const [rates, members, { dict }] = await Promise.all([
    getCachedRates(family.id),
    getFamilyMembers(family.id),
    getServerI18n(),
    queryClient.prefetchQuery({
      queryKey: keys.transactions.list(family.id),
      queryFn: () => getTransactions(family.id, user.uid),
    }),
    queryClient.prefetchQuery({
      queryKey: keys.monthlySummaries.list(family.id),
      queryFn: () => getMonthlySummaries(family.id),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TransactionsView
        familyId={family.id}
        baseCurrency={family.baseCurrency}
        rates={rates}
        members={members}
        dict={dict}
      />
    </HydrationBoundary>
  );
}
```

Create `src/app/(dashboard)/transactions/loading.tsx`:

```tsx
import { PageSkeleton } from "@/components/ui/Skeleton";

export default function TransactionsLoading() {
  return (
    <div className="max-w-6xl mx-auto">
      <PageSkeleton rows={5} />
    </div>
  );
}
```

Create `src/app/(dashboard)/transactions/error.tsx`:

```tsx
"use client";

import { useEffect } from "react";

export default function TransactionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="text-center py-16">
      <p className="text-muted mb-4">Failed to load transactions: {error.message}</p>
      <button type="button" onClick={reset} className="text-accent hover:underline">
        Try again
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Verify build + lint**

```bash
pnpm lint:fix && pnpm build
```

Expected: no NEW errors introduced by these six files.

- [ ] **Step 6: Commit**

```bash
git add src/components/transactions/TransactionList.tsx src/components/transactions/CashflowTrend.tsx src/components/transactions/TransactionsView.tsx "src/app/(dashboard)/transactions/page.tsx" "src/app/(dashboard)/transactions/loading.tsx" "src/app/(dashboard)/transactions/error.tsx"
git commit -m "feat(transactions): add transaction list, trend chart, and main page"
```

---

## Task 16: Cut over dashboard/nav/i18n, remove the old Income feature, and smoke test

**Files:**
- Modify: `src/components/dashboard/DashboardView.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/lib/i18n/dictionaries.ts`
- Delete: `src/lib/income.server.ts`, `src/lib/income.ts`, `src/actions/income.actions.ts`
- Delete: `src/app/api/income/route.ts`, `src/app/api/income/[incomeId]/route.ts`
- Delete: `src/app/(dashboard)/income/**` (all files)
- Delete: `src/components/income/**` (all files)

**Interfaces:**
- Consumes: `dict.transactions.monthlyNet` (from Task 11); `keys`, `data.monthlyNetTotal` (from Task 10).
- Produces: none new — this task retires the last references to the old Income feature so it can be deleted.

- [ ] **Step 1: Swap the dashboard stat tile**

In `src/components/dashboard/DashboardView.tsx`, replace:

```tsx
        <StatTile
          icon={TrendingUp}
          label={dict.income.monthlyIncome}
          value={formatCurrency(data.monthlyIncomeTotal, baseCurrency)}
        />
```

with:

```tsx
        <StatTile
          icon={TrendingUp}
          label={dict.transactions.monthlyNet}
          value={formatCurrency(data.monthlyNetTotal, baseCurrency)}
        />
```

- [ ] **Step 2: Swap the sidebar nav link**

In `src/components/layout/Sidebar.tsx`, replace:

```tsx
  { href: "/income", key: "income", icon: TrendingUp },
```

with:

```tsx
  { href: "/transactions", key: "transactions", icon: TrendingUp },
```

- [ ] **Step 3: Remove `income` from the `Dictionary` type, `en`, and `my`**

In `src/lib/i18n/dictionaries.ts`:

1. In the `nav` block of the `Dictionary` interface, replace `income: string;` with `transactions: string;`.
2. Delete the entire pre-existing `income: { ... };` block from the `Dictionary` interface — it sits directly before the `transactions: { ... };` block added in Task 11 and was untouched until now.
3. In the `en` dictionary's `nav` object, replace `income: "Income",` with `transactions: "Transactions",`.
4. Delete the entire pre-existing `income: { ... },` block from the `en` dictionary (directly before `transactions: { ... },` added in Task 11).
5. In the `my` dictionary's `nav` object, replace `income: "ဝင်ငွေ",` with `transactions: "ငွေစာရင်း",`.
6. Delete the entire pre-existing `income: { ... },` block from the `my` dictionary (directly before `transactions: { ... },` added in Task 11).

- [ ] **Step 4: Delete the old Income feature files**

```bash
git rm -r src/lib/income.server.ts src/lib/income.ts src/actions/income.actions.ts
git rm -r src/app/api/income
git rm -r "src/app/(dashboard)/income"
git rm -r src/components/income
```

- [ ] **Step 5: Verify build + lint**

```bash
pnpm lint:fix && pnpm build
```

Expected: build succeeds with zero TypeScript errors and Biome clean — this is the first point in the plan where the full repo (not just the new files) must be error-free, since every remaining reference to `Income`/`income.server.ts`/`dict.income`/`canViewIncome` has now been removed or replaced.

- [ ] **Step 6: Manual smoke test**

Run `pnpm dev` (requires local Firebase creds per CLAUDE.md) and verify:

- The "Transactions" link appears in the sidebar and routes to `/transactions`; the old `/income` route no longer exists.
- Add a recurring **expense** rule (e.g. "Rent", 1200 USD, monthly) via `/transactions/recurring/new`. It appears in the recurring rules list with today (or the near future) as "Next due".
- Manually trigger the cron once against a local/dev environment: `curl "http://localhost:3000/api/recurring-transactions?secret=$CRON_SECRET"`. Confirm the response reports `posted: 1` (or more, if other rules are due) and that the rule now shows a `nextDueDate` one period later.
- Confirm a new `Transaction` appears in `/transactions` for the posted rule, dated today, with `recurringRuleId` linking back to the rule (visible on the transaction detail page as a link to the rule).
- Re-trigger the same cron URL immediately again; confirm `posted: 0` for that rule (idempotency — no double-post).
- Log a one-off **income** transaction with category "Other" and a custom label (e.g. "Garage sale"); confirm the label shows on the list and detail views instead of the word "Other".
- Confirm `/transactions`'s "Income this month" / "Expenses this month" cards reflect the transactions logged so far, converted correctly if a non-base currency was used.
- Confirm the dashboard's stat tile now reads "Net cash flow" and shows `monthlyIncomeTotal − monthlyExpenseTotal`; confirm `totalNetWorth` is unchanged by any of this.
- Mark a transaction `private`; confirm it disappears from another member's `/transactions` list, but re-trigger the cron and confirm the family-wide totals reported by `/api/monthly-summaries` (visible once at least 2 months of summaries exist, or by inspecting the Firestore doc directly) still include its amount — the aggregate is visibility-agnostic by design.
- Confirm a `viewer`-role member cannot add a transaction or a recurring rule, and a non-owner, non-admin member cannot edit/delete someone else's.
- Delete a recurring rule; confirm its already-posted transactions remain in `/transactions` (history is preserved) and no further transactions post for it.

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/DashboardView.tsx src/components/layout/Sidebar.tsx src/lib/i18n/dictionaries.ts
git commit -m "feat(transactions): cut dashboard/nav/i18n over from Income; remove old feature"
```

---

## Self-Review Notes

- **Spec coverage:** unified income/expense data model (Task 1), recurring-rule CRUD + idempotent cron auto-posting (Tasks 2, 8), one-off manual transactions (Tasks 3, 7, 13), monthly summary snapshot + trend chart (Tasks 4, 8, 15), fixed categories + free-text `customLabel` on "Other" (Tasks 1, 6, 7, 12, 13, 15), dashboard integration without touching net worth (Task 10), aggregate-includes-private / itemized-respects-private visibility split (Global Constraints, Tasks 3–4, 16), `/transactions` route + nav rename (Tasks 12–16), i18n en+my (Task 11), full removal of the superseded Income feature (Task 16). All spec sections have a corresponding task.
- **Firestore composite-index pitfall:** called out explicitly in Global Constraints and re-noted at the two query sites that could have tripped it (`getCurrentMonthTransactions` in Task 3, `recordMonthlySummary` in Task 4) — both deliberately filter `deleted` in application code instead of as a second Firestore equality+range combination, so the cron won't throw `failed-precondition` in production on first run (there's no `firestore.indexes.json` in this repo to pre-provision one).
- **No new test runner** introduced (none exists); verification is build + lint + manual, consistent with the repo and the superseded income plan.
- **Type consistency:** `RecurringRule`/`Transaction`/`MonthlySummary` field names (`customLabel`, `recurringRuleId`, `nextDueDate`, `byCategoryBase`) and helper signatures (`monthlyEquivalent`, `nextDueDateAfter`, `canViewTransaction`, `canViewRecurringRule`, `keys.transactions.*`, `keys.recurringRules.*`, `keys.monthlySummaries.list`) are used identically across every task that references them.
- **Sequencing avoids build breaks:** Tasks 1–9 are purely additive (new files, or edits to shared files that don't remove anything the old Income feature depends on) and are expected to leave the *pre-existing* Task-1-flagged income errors in place, but introduce no new ones. Task 10 swaps `dashboard.server.ts`'s data source while preserving the `monthlyIncomeTotal` field name so `DashboardView.tsx` keeps compiling unchanged. Task 11 adds the `transactions` i18n block additively, alongside the still-present `income` block, so Tasks 12–15's new components (which reference `dict.transactions.*`) compile without yet touching `dict.income`. Task 16 is the single point where `dict.income`, `Sidebar`'s income link, `DashboardView`'s income tile, and every old Income file are removed together — the only task where all of it must land atomically to keep `pnpm build` green.
- **Assumptions flagged inline for the implementer:** existence of `plural`, `dict.common.saving`, `dict.common.saveChanges`, `VisibilityField`, `VisibilityBadge`, `EmptyState`, `PageSkeleton`, `btn-primary`/`btn-secondary`/`card`/`icon-chip` Tailwind utility classes — all already used by the assets/income features this mirrors; each is used identically here.
