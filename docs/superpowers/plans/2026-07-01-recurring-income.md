# Recurring Income Streams Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class income concept (recurring + one-off) that is tracked per family member and surfaced on a dedicated `/income` page and a dashboard card, without ever entering the net-worth total.

**Architecture:** A straight vertical copy of the existing assets feature. New Firestore subcollection `families/{id}/income`, a `*.server.ts` Firestore helper, a `"use server"` action layer with Zod validation, Route Handlers for client refetches, TanStack Query keys, and Server-Component pages that prefetch + hydrate. A pure `income.ts` helper normalizes each stream to a monthly-equivalent figure for the dashboard.

**Tech Stack:** Next.js 16 App Router, React 19, Firebase Admin SDK (Firestore), TanStack Query, Zod, Tailwind v4, Biome.

## Global Constraints

- **Package manager:** pnpm only. Never npm/yarn.
- **TypeScript strict:** no `any`, no `@ts-ignore`.
- **No test runner exists.** Verification per task = `pnpm build` (zero TS errors) and `pnpm lint` (Biome clean), plus manual smoke where noted. There is no Jest/Vitest; do NOT add one.
- **Three-layer rule:** Firestore access only in `src/lib/*.server.ts`; actions validate with Zod, log activity, `revalidatePath`; pages stay thin.
- **Never trust client identity:** always resolve family from the verified session (`getFamilyForUser(user.uid)` / `getRouteContext()`).
- **Income never enters net worth.** It is additive display data only.
- **Query keys** only from `src/lib/query/keys.ts` — never inline arrays.
- **No `console.log`** in committed code (`console.error` in `error.tsx` matches the existing pattern and is allowed).
- **Money:** always format via `formatCurrency`; convert via `convertAmount` with rates. Never render raw floats.
- **Biome format:** 2-space indent, 100 line width, double quotes, always semicolons. Run `pnpm lint:fix` before committing.
- **Firestore rules:** no change needed — income is read only through the Admin SDK; there is no client `onSnapshot` for income.

---

## File Structure

**New files:**
- `src/lib/income.ts` — pure helpers (`monthlyEquivalent`, `SUPPORTED_FREQUENCIES`).
- `src/lib/income.server.ts` — Firestore CRUD helpers (`server-only`).
- `src/actions/income.actions.ts` — `"use server"` create/update/delete actions + Zod schema.
- `src/app/api/income/route.ts` — GET list handler.
- `src/app/api/income/[incomeId]/route.ts` — GET single handler.
- `src/app/(dashboard)/income/page.tsx` — list page (prefetch + hydrate).
- `src/app/(dashboard)/income/loading.tsx`, `error.tsx` — segment states.
- `src/app/(dashboard)/income/new/page.tsx` — add form page.
- `src/app/(dashboard)/income/[incomeId]/page.tsx` — detail page.
- `src/app/(dashboard)/income/[incomeId]/edit/page.tsx` — edit form page.
- `src/components/income/IncomeView.tsx` — client list view.
- `src/components/income/IncomeList.tsx` — list rows.
- `src/components/income/IncomeForm.tsx` — add/edit form.
- `src/components/income/IncomeDetailView.tsx` — detail view.
- `src/components/income/DeleteIncomeButton.tsx` — delete button.

**Modified files:**
- `src/types/index.ts` — `Income`, `IncomeFrequency`.
- `src/lib/visibility.ts` — `canViewIncome`.
- `src/lib/activity.server.ts` — add `income_added` / `income_updated` to `ActivityType`.
- `src/lib/query/keys.ts` — `income` key block.
- `src/lib/dashboard.server.ts` — fetch income, add `monthlyIncomeTotal` to `DashboardData`.
- `src/components/dashboard/DashboardView.tsx` — income stat tile.
- `src/components/layout/Sidebar.tsx` — Income nav link.
- `src/lib/i18n/dictionaries.ts` — `income` block + `nav.income` (en + my).

---

## Task 1: Domain types, pure helper, and visibility

**Files:**
- Modify: `src/types/index.ts` (after the `Asset` interface, ~line 60)
- Create: `src/lib/income.ts`
- Modify: `src/lib/visibility.ts`

**Interfaces:**
- Produces: `Income`, `IncomeFrequency` (types); `monthlyEquivalent(amount: number, frequency: IncomeFrequency): number`; `SUPPORTED_FREQUENCIES: readonly IncomeFrequency[]`; `canViewIncome(income: Pick<Income, "ownerId" | "visibility">, viewerUid: string): boolean`.

- [ ] **Step 1: Add the domain types**

In `src/types/index.ts`, add after the `Visibility` type alias (near line 17):

```ts
export type IncomeFrequency = "weekly" | "monthly" | "quarterly" | "yearly" | "one_off";
```

And add this interface immediately after the `Asset` interface (after its closing brace, ~line 60):

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

- [ ] **Step 2: Create the pure income helper**

Create `src/lib/income.ts`:

```ts
// Pure income helpers — safe on both server and client (no Firestore / no
// "server-only"). Mirrors the currency.ts / visibility.ts shared-logic convention.
import type { IncomeFrequency } from "@/types";

// Single source of truth for the frequency dropdown, in display order.
export const SUPPORTED_FREQUENCIES = [
  "monthly",
  "weekly",
  "quarterly",
  "yearly",
  "one_off",
] as const satisfies readonly IncomeFrequency[];

// Normalizes a per-occurrence amount to its monthly-equivalent value, so income
// of any cadence can be summed into one comparable "per month" figure. One-off
// income is not recurring, so it contributes 0 to the recurring total.
export function monthlyEquivalent(amount: number, frequency: IncomeFrequency): number {
  switch (frequency) {
    case "weekly":
      return (amount * 52) / 12;
    case "monthly":
      return amount;
    case "quarterly":
      return amount / 3;
    case "yearly":
      return amount / 12;
    case "one_off":
      return 0;
  }
}
```

- [ ] **Step 3: Add `canViewIncome`**

In `src/lib/visibility.ts`, update the import and append the function:

```ts
import type { Asset, Income, Loan } from "@/types";
```

```ts
export function canViewIncome(
  income: Pick<Income, "ownerId" | "visibility">,
  viewerUid: string,
): boolean {
  return income.visibility === "shared" || income.ownerId === viewerUid;
}
```

- [ ] **Step 4: Verify build + lint**

```bash
pnpm lint:fix && pnpm build
```
Expected: build succeeds, zero TS errors, Biome clean.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/lib/income.ts src/lib/visibility.ts
git commit -m "feat(income): add Income types, monthly-equivalent helper, visibility"
```

---

## Task 2: Firestore helper (`income.server.ts`)

**Files:**
- Create: `src/lib/income.server.ts`

**Interfaces:**
- Consumes: `getAdminDb()` from `@/firebase/admin`; `canViewIncome` from `@/lib/visibility`; `Income`, `IncomeFrequency`, `Visibility` from `@/types`.
- Produces:
  - `getIncomes(familyId: string, viewerUid: string, ownerId?: string): Promise<Income[]>`
  - `getIncome(familyId: string, incomeId: string): Promise<Income | null>`
  - `createIncome(familyId, ownerId, data): Promise<string>` where `data` is `{ name; currency; amount; frequency; receivedAt?: Date | null; description; visibility }`
  - `updateIncome(familyId, incomeId, data: Partial<Pick<Income, "name" | "currency" | "amount" | "frequency" | "receivedAt" | "description" | "visibility">>): Promise<void>`
  - `softDeleteIncome(familyId, incomeId): Promise<void>`

- [ ] **Step 1: Create the helper**

Create `src/lib/income.server.ts`:

```ts
import "server-only";

import { FieldValue, type Query } from "firebase-admin/firestore";
import { getAdminDb } from "@/firebase/admin";
import { canViewIncome } from "@/lib/visibility";
import type { Income, IncomeFrequency, Visibility } from "@/types";

function docToIncome(doc: FirebaseFirestore.DocumentSnapshot): Income {
  const d = doc.data();
  if (!d) throw new Error("Income doc empty");
  return {
    id: doc.id,
    ownerId: d.ownerId,
    name: d.name,
    currency: d.currency,
    amount: d.amount,
    frequency: (d.frequency ?? "monthly") as IncomeFrequency,
    receivedAt: d.receivedAt ? d.receivedAt.toDate() : null,
    description: d.description ?? "",
    visibility: d.visibility ?? "shared",
    deleted: d.deleted ?? false,
    createdAt: d.createdAt.toDate(),
    updatedAt: d.updatedAt.toDate(),
  };
}

export async function getIncomes(
  familyId: string,
  viewerUid: string,
  ownerId?: string,
): Promise<Income[]> {
  let query: Query = getAdminDb()
    .collection(`families/${familyId}/income`)
    .where("deleted", "==", false)
    .orderBy("createdAt", "desc");

  if (ownerId) query = query.where("ownerId", "==", ownerId);

  const snap = await query.get();
  return snap.docs.map(docToIncome).filter((i) => canViewIncome(i, viewerUid));
}

export async function getIncome(familyId: string, incomeId: string): Promise<Income | null> {
  const snap = await getAdminDb().doc(`families/${familyId}/income/${incomeId}`).get();
  if (!snap.exists || snap.data()?.deleted) return null;
  return docToIncome(snap);
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k as keyof T] = v as T[keyof T];
  }
  return out;
}

export async function createIncome(
  familyId: string,
  ownerId: string,
  data: {
    name: string;
    currency: string;
    amount: number;
    frequency: IncomeFrequency;
    receivedAt?: Date | null;
    description: string;
    visibility: Visibility;
  },
): Promise<string> {
  const ref = getAdminDb().collection(`families/${familyId}/income`).doc();
  await ref.set({
    ...data,
    receivedAt: data.receivedAt ?? null,
    ownerId,
    deleted: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function updateIncome(
  familyId: string,
  incomeId: string,
  data: Partial<
    Pick<
      Income,
      "name" | "currency" | "amount" | "frequency" | "receivedAt" | "description" | "visibility"
    >
  >,
): Promise<void> {
  await getAdminDb()
    .doc(`families/${familyId}/income/${incomeId}`)
    .update({
      ...stripUndefined(data),
      updatedAt: FieldValue.serverTimestamp(),
    });
}

export async function softDeleteIncome(familyId: string, incomeId: string): Promise<void> {
  await getAdminDb().doc(`families/${familyId}/income/${incomeId}`).update({
    deleted: true,
    updatedAt: FieldValue.serverTimestamp(),
  });
}
```

- [ ] **Step 2: Verify build + lint**

```bash
pnpm lint:fix && pnpm build
```
Expected: build succeeds, zero TS errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/income.server.ts
git commit -m "feat(income): add Firestore CRUD helper"
```

---

## Task 3: Activity types, query keys, and Server Actions

**Files:**
- Modify: `src/lib/activity.server.ts:7-13` (the `ActivityType` union)
- Modify: `src/lib/query/keys.ts`
- Create: `src/actions/income.actions.ts`

**Interfaces:**
- Consumes: `createIncome`, `getIncome`, `softDeleteIncome`, `updateIncome` from `@/lib/income.server`; `requireUser` from `@/lib/auth.server`; `getFamilyForUser`, `getFamilyMembers` from `@/lib/family.server`; `formatCurrency` from `@/lib/currency.server`; `logActivity`, `deleteActivityForItem` from `@/lib/activity.server`; `canViewIncome` from `@/lib/visibility`.
- Produces:
  - `keys.income.all/list/detail`
  - `IncomeFormState` type
  - `createIncomeAction(prevState, formData): Promise<IncomeFormState>`
  - `updateIncomeAction(incomeId, prevState, formData): Promise<IncomeFormState>`
  - `deleteIncomeAction(incomeId): Promise<void>`

- [ ] **Step 1: Extend the activity type union**

In `src/lib/activity.server.ts`, update the `ActivityType` union to include income:

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

- [ ] **Step 2: Add income query keys**

In `src/lib/query/keys.ts`, add this block inside the `keys` object, after the `assets` block:

```ts
  income: {
    all: (familyId: string) => ["income", familyId] as const,
    list: (familyId: string, owner?: string) =>
      ["income", familyId, "list", owner ?? null] as const,
    detail: (familyId: string, incomeId: string) =>
      ["income", familyId, "detail", incomeId] as const,
  },
```

- [ ] **Step 3: Create the actions**

Create `src/actions/income.actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { deleteActivityForItem, logActivity } from "@/lib/activity.server";
import { requireUser } from "@/lib/auth.server";
import { formatCurrency } from "@/lib/currency.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { createIncome, getIncome, softDeleteIncome, updateIncome } from "@/lib/income.server";
import { canViewIncome } from "@/lib/visibility";

export type IncomeFormState = { errors?: Record<string, string[]> } | null;

const IncomeSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100),
    currency: z.string().length(3, "Invalid currency"),
    amount: z.coerce.number().positive("Amount must be positive"),
    frequency: z.enum(["weekly", "monthly", "quarterly", "yearly", "one_off"]),
    receivedAt: z.string().optional(),
    description: z.string().max(500).optional().default(""),
    visibility: z.enum(["private", "shared"]).default("shared"),
  })
  .superRefine((d, ctx) => {
    if (d.frequency === "one_off" && !d.receivedAt) {
      ctx.addIssue({ code: "custom", path: ["receivedAt"], message: "Date is required" });
    }
  });

// Normalize a validated form into the shape persisted by the income helper.
// receivedAt is only stored for one-off income; recurring streams null it out.
function toIncomeData(data: z.infer<typeof IncomeSchema>) {
  return {
    name: data.name,
    currency: data.currency,
    amount: data.amount,
    frequency: data.frequency,
    receivedAt: data.frequency === "one_off" && data.receivedAt ? new Date(data.receivedAt) : null,
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

export async function createIncomeAction(
  _prevState: IncomeFormState,
  formData: FormData,
): Promise<IncomeFormState> {
  const { user, family } = await getContextOrThrow();

  const members = await getFamilyMembers(family.id);
  if (members.find((m) => m.uid === user.uid)?.role === "viewer") {
    return { errors: { _: ["Viewers cannot add income"] } };
  }

  const parsed = IncomeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const incomeData = toIncomeData(parsed.data);
  const incomeId = await createIncome(family.id, user.uid, incomeData);

  await logActivity(
    family.id,
    "income_added",
    `Added income "${incomeData.name}" (${formatCurrency(incomeData.amount, incomeData.currency)})`,
    incomeData.visibility,
    incomeId,
  );

  revalidatePath("/income");
  revalidatePath("/dashboard");
  redirect(`/income/${incomeId}`);
}

export async function updateIncomeAction(
  incomeId: string,
  _prevState: IncomeFormState,
  formData: FormData,
): Promise<IncomeFormState> {
  const { user, family } = await getContextOrThrow();

  const existing = await getIncome(family.id, incomeId);
  if (!existing || !canViewIncome(existing, user.uid)) {
    return { errors: { _: ["Income not found"] } };
  }

  await assertCanMutate(family.id, existing.ownerId, user.uid);

  const parsed = IncomeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const incomeData = toIncomeData(parsed.data);
  await updateIncome(family.id, incomeId, incomeData);

  if (incomeData.visibility === "private") {
    await deleteActivityForItem(family.id, incomeId);
  } else {
    await logActivity(
      family.id,
      "income_updated",
      `Updated income "${incomeData.name}"`,
      incomeData.visibility,
      incomeId,
    );
  }

  revalidatePath("/income");
  revalidatePath(`/income/${incomeId}`);
  revalidatePath("/dashboard");
  redirect(`/income/${incomeId}`);
}

export async function deleteIncomeAction(incomeId: string): Promise<void> {
  const { user, family } = await getContextOrThrow();

  const existing = await getIncome(family.id, incomeId);
  if (!existing || !canViewIncome(existing, user.uid)) throw new Error("Not found");

  await assertCanMutate(family.id, existing.ownerId, user.uid);

  await softDeleteIncome(family.id, incomeId);
  revalidatePath("/income");
  revalidatePath("/dashboard");
  redirect("/income");
}
```

- [ ] **Step 4: Verify build + lint**

```bash
pnpm lint:fix && pnpm build
```
Expected: build succeeds, zero TS errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/activity.server.ts src/lib/query/keys.ts src/actions/income.actions.ts
git commit -m "feat(income): add activity types, query keys, and server actions"
```

---

## Task 4: Route Handlers for client refetches

**Files:**
- Create: `src/app/api/income/route.ts`
- Create: `src/app/api/income/[incomeId]/route.ts`

**Interfaces:**
- Consumes: `getIncomes`, `getIncome` from `@/lib/income.server`; `getRouteContext`, `isErrorResponse` from `@/lib/query/route-context.server`; `canViewIncome` from `@/lib/visibility`.
- Produces: `GET /api/income` (JSON `Income[]`), `GET /api/income/[incomeId]` (JSON `Income` or 404).

- [ ] **Step 1: Create the list handler**

Create `src/app/api/income/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getIncomes } from "@/lib/income.server";
import { getRouteContext, isErrorResponse } from "@/lib/query/route-context.server";

// Client-data read for the income list. `getIncomes` enforces visibility
// (canViewIncome) server-side, so private items never leave the server.
export async function GET(request: Request) {
  const ctx = await getRouteContext();
  if (isErrorResponse(ctx)) return ctx;

  const owner = new URL(request.url).searchParams.get("owner") ?? undefined;
  const income = await getIncomes(ctx.family.id, ctx.user.uid, owner);
  return NextResponse.json(income);
}
```

- [ ] **Step 2: Create the single-item handler**

Create `src/app/api/income/[incomeId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getIncome } from "@/lib/income.server";
import { getRouteContext, isErrorResponse } from "@/lib/query/route-context.server";
import { canViewIncome } from "@/lib/visibility";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ incomeId: string }> },
) {
  const ctx = await getRouteContext();
  if (isErrorResponse(ctx)) return ctx;

  const { incomeId } = await params;
  const income = await getIncome(ctx.family.id, incomeId);
  if (!income || !canViewIncome(income, ctx.user.uid)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(income);
}
```

- [ ] **Step 3: Verify build + lint**

```bash
pnpm lint:fix && pnpm build
```
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/income
git commit -m "feat(income): add route handlers for client refetches"
```

---

## Task 5: i18n dictionary entries

**Files:**
- Modify: `src/lib/i18n/dictionaries.ts` — the `Dictionary` type, `nav` blocks, and both `en` / `my` dictionaries.

**Interfaces:**
- Produces: `dict.nav.income`, `dict.income.*` keys used by all UI in Tasks 6–8.

- [ ] **Step 1: Add `income` to the `nav` type and both dictionaries**

In `src/lib/i18n/dictionaries.ts`, find the `nav` type (`{ overview: string; assets: string; loans: string; members: string; profile: string }`) and add `income: string;`. Then in BOTH the `en` and `my` `nav` objects add an `income` value:
- en: `income: "Income",`
- my: `income: "ဝင်ငွေ",`

- [ ] **Step 2: Add the `income` block to the `Dictionary` type**

Add this shape to the `Dictionary` type (mirroring the `assets` block position):

```ts
  income: {
    title: string;
    unitOne: string;
    unitOther: string;
    addIncome: string;
    monthlyTotal: string;
    monthlyIncome: string;
    noIncomeTitle: string;
    noIncomeDesc: string;
    noMatchTitle: string;
    noMatchDesc: string;
    name: string;
    amount: string;
    currency: string;
    frequency: string;
    receivedAt: string;
    owner: string;
    description: string;
    descriptionOptional: string;
    unknownOwner: string;
    addTitle: string;
    editTitle: string;
    createIncome: string;
    delete: string;
    edit: string;
    deleteConfirm: string;
    privateLock: string;
    oneOffBadge: string;
    frequencies: {
      weekly: string;
      monthly: string;
      quarterly: string;
      yearly: string;
      one_off: string;
    };
  };
```

- [ ] **Step 3: Add the English `income` values**

In the `en` dictionary, after the `assets` block, add:

```ts
  income: {
    title: "Income",
    unitOne: "stream",
    unitOther: "streams",
    addIncome: "Add income",
    monthlyTotal: "Monthly income (recurring)",
    monthlyIncome: "Monthly income",
    noIncomeTitle: "No income yet",
    noIncomeDesc: "Add a salary or other recurring income to track it here.",
    noMatchTitle: "No matches",
    noMatchDesc: "No income matches your filters.",
    name: "Name",
    amount: "Amount",
    currency: "Currency",
    frequency: "Frequency",
    receivedAt: "Date received",
    owner: "Owner",
    description: "Description",
    descriptionOptional: "Description (optional)",
    unknownOwner: "Unknown",
    addTitle: "Add income",
    editTitle: "Edit income",
    createIncome: "Add income",
    delete: "Delete",
    edit: "Edit",
    deleteConfirm: "Delete",
    privateLock: "Private",
    oneOffBadge: "One-off",
    frequencies: {
      weekly: "Weekly",
      monthly: "Monthly",
      quarterly: "Quarterly",
      yearly: "Yearly",
      one_off: "One-off",
    },
  },
```

- [ ] **Step 4: Add the Burmese `income` values**

In the `my` dictionary, after the `assets` block, add:

```ts
  income: {
    title: "ဝင်ငွေ",
    unitOne: "လမ်းကြောင်း",
    unitOther: "လမ်းကြောင်းများ",
    addIncome: "ဝင်ငွေ ထည့်ရန်",
    monthlyTotal: "လစဉ် ဝင်ငွေ (ပုံမှန်)",
    monthlyIncome: "လစဉ် ဝင်ငွေ",
    noIncomeTitle: "ဝင်ငွေ မရှိသေးပါ",
    noIncomeDesc: "လစာ သို့မဟုတ် ပုံမှန်ဝင်ငွေ ထည့်၍ ဤနေရာတွင် ခြေရာခံပါ။",
    noMatchTitle: "ကိုက်ညီမှု မရှိပါ",
    noMatchDesc: "သင့်စစ်ထုတ်မှုနှင့် ကိုက်ညီသော ဝင်ငွေ မရှိပါ။",
    name: "အမည်",
    amount: "ပမာဏ",
    currency: "ငွေကြေး",
    frequency: "အကြိမ်ရေ",
    receivedAt: "ရရှိသည့်ရက်စွဲ",
    owner: "ပိုင်ရှင်",
    description: "ဖော်ပြချက်",
    descriptionOptional: "ဖော်ပြချက် (ရွေးချယ်ခွင့်)",
    unknownOwner: "မသိ",
    addTitle: "ဝင်ငွေ ထည့်ရန်",
    editTitle: "ဝင်ငွေ ပြင်ဆင်ရန်",
    createIncome: "ဝင်ငွေ ထည့်ရန်",
    delete: "ဖျက်ရန်",
    edit: "ပြင်ဆင်ရန်",
    deleteConfirm: "ဖျက်မလား",
    privateLock: "သီးသန့်",
    oneOffBadge: "တစ်ကြိမ်တည်း",
    frequencies: {
      weekly: "အပတ်စဉ်",
      monthly: "လစဉ်",
      quarterly: "သုံးလတစ်ကြိမ်",
      yearly: "နှစ်စဉ်",
      one_off: "တစ်ကြိမ်တည်း",
    },
  },
```

- [ ] **Step 5: Verify build + lint**

```bash
pnpm lint:fix && pnpm build
```
Expected: build succeeds. If TS complains a dictionary is missing a key, the `en`/`my` objects and the type are now out of sync — reconcile them.

- [ ] **Step 6: Commit**

```bash
git add src/lib/i18n/dictionaries.ts
git commit -m "feat(income): add i18n strings for income (en + my)"
```

---

## Task 6: Income UI — components and routes

**Files:**
- Create: `src/components/income/IncomeForm.tsx`
- Create: `src/components/income/IncomeList.tsx`
- Create: `src/components/income/IncomeView.tsx`
- Create: `src/components/income/IncomeDetailView.tsx`
- Create: `src/components/income/DeleteIncomeButton.tsx`
- Create: `src/app/(dashboard)/income/page.tsx`
- Create: `src/app/(dashboard)/income/loading.tsx`
- Create: `src/app/(dashboard)/income/error.tsx`
- Create: `src/app/(dashboard)/income/new/page.tsx`
- Create: `src/app/(dashboard)/income/[incomeId]/page.tsx`
- Create: `src/app/(dashboard)/income/[incomeId]/edit/page.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–5. Uses `VisibilityField` (`@/components/ui/VisibilityField`), `VisibilityBadge` (`@/components/ui/VisibilityBadge`), `EmptyState` (`@/components/ui/EmptyState`), `PageSkeleton` (`@/components/ui/Skeleton`), `useI18n` (`@/components/i18n/I18nProvider`).

- [ ] **Step 1: Create `DeleteIncomeButton.tsx`**

Create `src/components/income/DeleteIncomeButton.tsx`:

```tsx
"use client";

import { deleteIncomeAction } from "@/actions/income.actions";
import { useI18n } from "@/components/i18n/I18nProvider";

export function DeleteIncomeButton({ incomeId, label }: { incomeId: string; label: string }) {
  const { dict } = useI18n();
  const action = deleteIncomeAction.bind(null, incomeId);

  return (
    <form action={action}>
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm(`${dict.income.deleteConfirm} ${label}?`)) e.preventDefault();
        }}
        className="text-sm text-red-500 hover:text-red-700"
      >
        {dict.income.delete}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create `IncomeForm.tsx`**

Create `src/components/income/IncomeForm.tsx`. The `receivedAt` date input is shown only when frequency is `one_off`:

```tsx
"use client";

import { useActionState, useState } from "react";
import type { IncomeFormState } from "@/actions/income.actions";
import { useI18n } from "@/components/i18n/I18nProvider";
import { VisibilityField } from "@/components/ui/VisibilityField";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { SUPPORTED_FREQUENCIES } from "@/lib/income";
import type { Income, IncomeFrequency } from "@/types";

interface Props {
  action: (prevState: IncomeFormState, formData: FormData) => Promise<IncomeFormState>;
  defaultValues?: Partial<Income>;
  submitLabel?: string;
}

// Renders a yyyy-mm-dd value for the native date input.
function toDateInput(date?: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export function IncomeForm({ action, defaultValues, submitLabel }: Props) {
  const { dict } = useI18n();
  const [state, formAction, pending] = useActionState<IncomeFormState, FormData>(action, null);
  const [frequency, setFrequency] = useState<IncomeFrequency>(
    defaultValues?.frequency ?? "monthly",
  );

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="income-name" className="block text-sm font-medium text-foreground/80 mb-1">
          {dict.income.name}
        </label>
        <input
          id="income-name"
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
            htmlFor="income-amount"
            className="block text-sm font-medium text-foreground/80 mb-1"
          >
            {dict.income.amount}
          </label>
          <input
            id="income-amount"
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
            htmlFor="income-currency"
            className="block text-sm font-medium text-foreground/80 mb-1"
          >
            {dict.income.currency}
          </label>
          <select
            id="income-currency"
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
          htmlFor="income-frequency"
          className="block text-sm font-medium text-foreground/80 mb-1"
        >
          {dict.income.frequency}
        </label>
        <select
          id="income-frequency"
          name="frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as IncomeFrequency)}
          className="w-full px-4 py-2 border border-line rounded-lg"
        >
          {SUPPORTED_FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {dict.income.frequencies[f]}
            </option>
          ))}
        </select>
      </div>

      {frequency === "one_off" && (
        <div>
          <label
            htmlFor="income-received"
            className="block text-sm font-medium text-foreground/80 mb-1"
          >
            {dict.income.receivedAt}
          </label>
          <input
            id="income-received"
            name="receivedAt"
            type="date"
            defaultValue={toDateInput(defaultValues?.receivedAt)}
            className="w-full px-4 py-2 border border-line rounded-lg"
          />
          {state?.errors?.receivedAt && (
            <p className="text-sm text-red-500 mt-1">{state.errors.receivedAt[0]}</p>
          )}
        </div>
      )}

      <div>
        <label
          htmlFor="income-description"
          className="block text-sm font-medium text-foreground/80 mb-1"
        >
          {dict.income.descriptionOptional}
        </label>
        <textarea
          id="income-description"
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
        {pending ? dict.common.saving : (submitLabel ?? dict.income.createIncome)}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Create `IncomeList.tsx`**

Create `src/components/income/IncomeList.tsx`:

```tsx
import { ChevronRight, Lock, Wallet } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { convertAmount, formatCurrency } from "@/lib/currency";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { monthlyEquivalent } from "@/lib/income";
import type { Income } from "@/types";

interface Props {
  income: Income[];
  memberMap: Record<string, string>;
  baseCurrency: string;
  rates: Record<string, number>;
  dict: Dictionary;
  filtered?: boolean;
}

export function IncomeList({ income, memberMap, baseCurrency, rates, dict, filtered }: Props) {
  if (income.length === 0) {
    return filtered ? (
      <EmptyState
        icon={Wallet}
        title={dict.income.noMatchTitle}
        description={dict.income.noMatchDesc}
      />
    ) : (
      <EmptyState
        icon={Wallet}
        title={dict.income.noIncomeTitle}
        description={dict.income.noIncomeDesc}
        action={{ label: dict.income.addIncome, href: "/income/new" }}
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {income.map((item) => {
        const perMonth = convertAmount(
          monthlyEquivalent(item.amount, item.frequency),
          item.currency,
          baseCurrency,
          rates,
        );
        return (
          <Link key={item.id} href={`/income/${item.id}`} className="block">
            <div className="card card-hover p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground truncate">{item.name}</p>
                  <span className="hidden sm:inline shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent-soft text-accent-strong">
                    {dict.income.frequencies[item.frequency]}
                  </span>
                  {item.visibility === "private" && (
                    <Lock
                      className="shrink-0 w-3.5 h-3.5 text-muted/70"
                      aria-label={dict.income.privateLock}
                    />
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted truncate">
                  {memberMap[item.ownerId] ?? dict.income.unknownOwner}
                </p>
              </div>

              <div className="text-right shrink-0">
                <p className="font-semibold text-foreground tabular-nums">
                  {formatCurrency(item.amount, item.currency)}
                </p>
                {item.frequency !== "one_off" && (
                  <p className="text-xs text-muted tabular-nums">
                    ≈ {formatCurrency(perMonth, baseCurrency)}/mo
                  </p>
                )}
              </div>

              <ChevronRight className="w-4 h-4 text-muted/60 shrink-0" aria-hidden="true" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Create `IncomeView.tsx`**

Create `src/components/income/IncomeView.tsx`. The headline card shows the monthly recurring total (one-off excluded via `monthlyEquivalent`):

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { IncomeList } from "@/components/income/IncomeList";
import { convertAmount, formatCurrency } from "@/lib/currency";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { plural } from "@/lib/i18n/dictionaries";
import { monthlyEquivalent } from "@/lib/income";
import { fetchJson } from "@/lib/query/fetch-json";
import { keys } from "@/lib/query/keys";
import type { FamilyMember, Income } from "@/types";

interface Props {
  familyId: string;
  baseCurrency: string;
  rates: Record<string, number>;
  members: FamilyMember[];
  dict: Dictionary;
}

export function IncomeView({ familyId, baseCurrency, rates, members, dict }: Props) {
  const { data: income = [] } = useQuery({
    queryKey: keys.income.list(familyId),
    queryFn: () => fetchJson<Income[]>("/api/income"),
  });

  const memberMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.uid, m.displayName])),
    [members],
  );

  const monthlyTotal = income.reduce(
    (sum, i) =>
      sum + convertAmount(monthlyEquivalent(i.amount, i.frequency), i.currency, baseCurrency, rates),
    0,
  );
  const count = income.length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{dict.income.title}</h1>
          <p className="text-sm text-muted mt-1">
            {count} {plural(count, dict.income.unitOne, dict.income.unitOther)} · {baseCurrency}
          </p>
        </div>
        <Link href="/income/new" className="btn-primary shrink-0">
          {dict.income.addIncome}
        </Link>
      </div>

      <div className="card p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{dict.income.monthlyTotal}</p>
          <p className="text-3xl font-bold text-foreground mt-1 tracking-tight tabular-nums">
            {formatCurrency(monthlyTotal, baseCurrency)}
          </p>
        </div>
        <span className="icon-chip">
          <TrendingUp className="w-5 h-5" aria-hidden="true" />
        </span>
      </div>

      <IncomeList
        income={income}
        memberMap={memberMap}
        baseCurrency={baseCurrency}
        rates={rates}
        dict={dict}
      />
    </div>
  );
}
```

NOTE: confirm `plural` is exported from `@/lib/i18n/dictionaries` (it is used the same way in `AssetsView.tsx`). If its signature differs, match the `AssetsView` call.

- [ ] **Step 5: Create `IncomeDetailView.tsx`**

Create `src/components/income/IncomeDetailView.tsx`:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { DeleteIncomeButton } from "@/components/income/DeleteIncomeButton";
import { VisibilityBadge } from "@/components/ui/VisibilityBadge";
import { convertAmount, formatCurrency } from "@/lib/currency";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { monthlyEquivalent } from "@/lib/income";
import { fetchJson } from "@/lib/query/fetch-json";
import { keys } from "@/lib/query/keys";
import type { Income } from "@/types";

interface Props {
  familyId: string;
  incomeId: string;
  baseCurrency: string;
  rates: Record<string, number>;
  ownerName: string;
  canMutate: boolean;
  dict: Dictionary;
}

export function IncomeDetailView({
  familyId,
  incomeId,
  baseCurrency,
  rates,
  ownerName,
  canMutate,
  dict,
}: Props) {
  const { data: income } = useQuery({
    queryKey: keys.income.detail(familyId, incomeId),
    queryFn: () => fetchJson<Income>(`/api/income/${incomeId}`),
  });

  if (!income) return null;

  const perMonth = convertAmount(
    monthlyEquivalent(income.amount, income.frequency),
    income.currency,
    baseCurrency,
    rates,
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-foreground">{income.name}</h1>
          <VisibilityBadge visibility={income.visibility} />
        </div>
        {canMutate && (
          <div className="flex items-center gap-3">
            <Link
              href={`/income/${income.id}/edit`}
              className="text-sm text-accent hover:underline"
            >
              {dict.income.edit}
            </Link>
            <DeleteIncomeButton incomeId={income.id} label={income.name} />
          </div>
        )}
      </div>

      <dl className="bg-card rounded-xl border border-line divide-y divide-line">
        <Row label={dict.income.amount}>
          <span className="font-semibold">{formatCurrency(income.amount, income.currency)}</span>
        </Row>
        <Row label={dict.income.frequency}>{dict.income.frequencies[income.frequency]}</Row>
        {income.frequency !== "one_off" && (
          <Row label={dict.income.monthlyIncome}>
            <span className="font-semibold">{formatCurrency(perMonth, baseCurrency)}</span>
          </Row>
        )}
        {income.frequency === "one_off" && income.receivedAt && (
          <Row label={dict.income.receivedAt}>{income.receivedAt.toLocaleDateString()}</Row>
        )}
        <Row label={dict.income.owner}>{ownerName}</Row>
        {income.description && <Row label={dict.income.description}>{income.description}</Row>}
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

- [ ] **Step 6: Create the list page + loading + error**

Create `src/app/(dashboard)/income/page.tsx`:

```tsx
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { IncomeView } from "@/components/income/IncomeView";
import { requireUser } from "@/lib/auth.server";
import { getCachedRates } from "@/lib/currency.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getServerI18n } from "@/lib/i18n/server";
import { getIncomes } from "@/lib/income.server";
import { getQueryClient } from "@/lib/query/get-query-client";
import { keys } from "@/lib/query/keys";

export default async function IncomePage() {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const queryClient = getQueryClient();
  const [rates, members, { dict }] = await Promise.all([
    getCachedRates(family.id),
    getFamilyMembers(family.id),
    getServerI18n(),
    queryClient.prefetchQuery({
      queryKey: keys.income.list(family.id),
      queryFn: () => getIncomes(family.id, user.uid),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <IncomeView
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

Create `src/app/(dashboard)/income/loading.tsx`:

```tsx
import { PageSkeleton } from "@/components/ui/Skeleton";

export default function IncomeLoading() {
  return (
    <div className="max-w-6xl mx-auto">
      <PageSkeleton rows={5} />
    </div>
  );
}
```

Create `src/app/(dashboard)/income/error.tsx`:

```tsx
"use client";

import { useEffect } from "react";

export default function IncomeError({
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
      <p className="text-muted mb-4">Failed to load income: {error.message}</p>
      <button type="button" onClick={reset} className="text-accent hover:underline">
        Try again
      </button>
    </div>
  );
}
```

- [ ] **Step 7: Create the new / detail / edit pages**

Create `src/app/(dashboard)/income/new/page.tsx`:

```tsx
import { createIncomeAction } from "@/actions/income.actions";
import { IncomeForm } from "@/components/income/IncomeForm";
import { getServerI18n } from "@/lib/i18n/server";

export default async function NewIncomePage() {
  const { dict } = await getServerI18n();
  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold text-foreground mb-6">{dict.income.addTitle}</h1>
      <IncomeForm action={createIncomeAction} submitLabel={dict.income.createIncome} />
    </div>
  );
}
```

Create `src/app/(dashboard)/income/[incomeId]/page.tsx`:

```tsx
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { IncomeDetailView } from "@/components/income/IncomeDetailView";
import { requireUser } from "@/lib/auth.server";
import { getCachedRates } from "@/lib/currency.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getServerI18n } from "@/lib/i18n/server";
import { getIncome } from "@/lib/income.server";
import { getQueryClient } from "@/lib/query/get-query-client";
import { keys } from "@/lib/query/keys";
import { canViewIncome } from "@/lib/visibility";

export default async function IncomeDetailPage({
  params,
}: {
  params: Promise<{ incomeId: string }>;
}) {
  const { incomeId } = await params;
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const income = await getIncome(family.id, incomeId);
  if (!income || !canViewIncome(income, user.uid)) notFound();

  const [rates, members, { dict }] = await Promise.all([
    getCachedRates(family.id),
    getFamilyMembers(family.id),
    getServerI18n(),
  ]);

  const queryClient = getQueryClient();
  queryClient.setQueryData(keys.income.detail(family.id, incomeId), income);

  const owner = members.find((m) => m.uid === income.ownerId);
  const self = members.find((m) => m.uid === user.uid);
  const canMutate = income.ownerId === user.uid || self?.role === "admin";

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <IncomeDetailView
        familyId={family.id}
        incomeId={incomeId}
        baseCurrency={family.baseCurrency}
        rates={rates}
        ownerName={owner?.displayName ?? dict.income.unknownOwner}
        canMutate={canMutate}
        dict={dict}
      />
    </HydrationBoundary>
  );
}
```

Create `src/app/(dashboard)/income/[incomeId]/edit/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import { updateIncomeAction } from "@/actions/income.actions";
import { IncomeForm } from "@/components/income/IncomeForm";
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getServerI18n } from "@/lib/i18n/server";
import { getIncome } from "@/lib/income.server";
import { canViewIncome } from "@/lib/visibility";

export default async function EditIncomePage({
  params,
}: {
  params: Promise<{ incomeId: string }>;
}) {
  const { incomeId } = await params;
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const income = await getIncome(family.id, incomeId);
  if (!income || !canViewIncome(income, user.uid)) notFound();

  const members = await getFamilyMembers(family.id);
  const self = members.find((m) => m.uid === user.uid);
  const canMutate = income.ownerId === user.uid || self?.role === "admin";
  if (!canMutate) redirect(`/income/${income.id}`);

  const boundAction = updateIncomeAction.bind(null, income.id);
  const { dict } = await getServerI18n();

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold text-foreground mb-6">{dict.income.editTitle}</h1>
      <IncomeForm
        action={boundAction}
        defaultValues={income}
        submitLabel={dict.common.saveChanges}
      />
    </div>
  );
}
```

- [ ] **Step 8: Verify build + lint**

```bash
pnpm lint:fix && pnpm build
```
Expected: build succeeds, zero TS errors. If `dict.common.saving` / `dict.common.saveChanges` don't exist, check the `common` block in `dictionaries.ts` and use the correct keys (they are used identically by `AssetForm`).

- [ ] **Step 9: Commit**

```bash
git add src/components/income "src/app/(dashboard)/income"
git commit -m "feat(income): add income pages and components"
```

---

## Task 7: Dashboard integration

**Files:**
- Modify: `src/lib/dashboard.server.ts` (imports, `DashboardData` interface ~line 22, `getDashboardData` body)
- Modify: `src/components/dashboard/DashboardView.tsx` (imports + the stat-tile grid ~lines 61-77)

**Interfaces:**
- Consumes: `getIncomes` from `@/lib/income.server`; `monthlyEquivalent` from `@/lib/income`.
- Produces: `DashboardData.monthlyIncomeTotal: number`.

- [ ] **Step 1: Compute and expose `monthlyIncomeTotal`**

In `src/lib/dashboard.server.ts`, add imports at the top:

```ts
import { getIncomes } from "@/lib/income.server";
import { monthlyEquivalent } from "@/lib/income";
```

Add the field to the `DashboardData` interface (after `liabilitiesTotal`):

```ts
  monthlyIncomeTotal: number;
```

In `getDashboardData`, fetch income and compute the total. Add this after the `assets`/`activeLoans` are resolved (income is independent, so place it near the top-level reads):

```ts
  const income = await getIncomes(familyId, viewerUid);
  const monthlyIncomeTotal = income.reduce(
    (sum, i) =>
      sum + convertAmount(monthlyEquivalent(i.amount, i.frequency), i.currency, baseCurrency, rates),
    0,
  );
```

Then add `monthlyIncomeTotal` to the returned object:

```ts
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

NOTE: `convertAmount` and `getCachedRates` (`rates`) are already imported and in scope in this file. `totalNetWorth` is unchanged — income is NOT added to it.

- [ ] **Step 2: Render the income stat tile**

In `src/components/dashboard/DashboardView.tsx`, add `TrendingUp` to the `lucide-react` import:

```tsx
import { ArrowDownLeft, ArrowUpRight, BarChart3, Handshake, LineChart, TrendingUp, Wallet } from "lucide-react";
```

Change the stat grid from 3 columns to 4 and add the income tile. Replace the `<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">` block (lines ~61-77) with:

```tsx
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          icon={Wallet}
          label={dict.dashboard.assets}
          value={formatCurrency(data.assetsTotal, baseCurrency)}
        />
        <StatTile
          icon={TrendingUp}
          label={dict.income.monthlyIncome}
          value={formatCurrency(data.monthlyIncomeTotal, baseCurrency)}
        />
        <StatTile
          icon={ArrowUpRight}
          label={dict.dashboard.owedToFamily}
          value={formatCurrency(data.receivablesTotal, baseCurrency)}
        />
        <StatTile
          icon={ArrowDownLeft}
          label={dict.dashboard.owedByFamily}
          value={formatCurrency(data.liabilitiesTotal, baseCurrency)}
        />
      </div>
```

- [ ] **Step 3: Verify build + lint**

```bash
pnpm lint:fix && pnpm build
```
Expected: build succeeds. The `/api/dashboard` route already returns `getDashboardData(...)` verbatim, so `monthlyIncomeTotal` flows through with no route change.

- [ ] **Step 4: Commit**

```bash
git add src/lib/dashboard.server.ts src/components/dashboard/DashboardView.tsx
git commit -m "feat(income): show monthly income on the dashboard"
```

---

## Task 8: Navigation link and final verification

**Files:**
- Modify: `src/components/layout/Sidebar.tsx` (imports + `NAV_ITEMS`)

- [ ] **Step 1: Add the Income nav item**

In `src/components/layout/Sidebar.tsx`, add `TrendingUp` to the `lucide-react` import:

```tsx
import { Handshake, LayoutDashboard, TrendingUp, User, Users, Wallet } from "lucide-react";
```

Add the income entry to `NAV_ITEMS`, after assets:

```tsx
const NAV_ITEMS = [
  { href: "/dashboard", key: "overview", icon: LayoutDashboard },
  { href: "/assets", key: "assets", icon: Wallet },
  { href: "/income", key: "income", icon: TrendingUp },
  { href: "/loans", key: "loans", icon: Handshake },
  { href: "/members", key: "members", icon: Users },
  { href: "/profile", key: "profile", icon: User },
] as const;
```

`dict.nav.income` was added in Task 5, so `dict.nav[item.key]` resolves.

- [ ] **Step 2: Verify build + lint**

```bash
pnpm lint:fix && pnpm build
```
Expected: build succeeds, zero TS errors.

- [ ] **Step 3: Manual smoke test**

Run `pnpm dev` and verify (requires local Firebase creds per CLAUDE.md):
- The "Income" link appears in the sidebar and routes to `/income`.
- Add a monthly income of 1000 USD → income list shows it; the monthly card and the dashboard "Monthly income" tile both show ≈ the base-currency equivalent of 1000.
- Add a yearly income of 12000 USD → contributes ≈ 1000/mo to the totals.
- Add a one-off income with a date → shown in the list with its date, but contributes 0 to the monthly total.
- Confirm net worth on the dashboard is UNCHANGED by any income.
- Mark an income `private` → it disappears from another member's `/income` and dashboard total; a `viewer` cannot add income.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(income): add income navigation link"
```

---

## Self-Review Notes

- **Spec coverage:** data model (T1), monthly-equivalent + one-off=0 (T1, used in T6/T7), full-parity ownership/visibility/roles (T2 `canViewIncome`, T3 `assertCanMutate`/viewer block), server/lib/action layering (T2/T3), Route Handlers (T4), TanStack prefetch+hydrate pages (T6), dashboard card with net-worth untouched (T7), dedicated `/income` route (T6), nav (T8), i18n en+my (T5), no Firestore rule change (documented, no task needed). All covered.
- **No new test runner** introduced (none exists); verification is build + lint + manual, consistent with the repo.
- **Type consistency:** `monthlyEquivalent`, `canViewIncome`, `keys.income.*`, `IncomeFormState`, and the `Income` field names (`receivedAt`, `frequency`) are used identically across tasks.
- **Assumptions flagged inline for the implementer:** existence of `plural`, `dict.common.saving`, `dict.common.saveChanges`, `VisibilityField`, `VisibilityBadge`, `EmptyState`, `PageSkeleton` — all already used by the asset feature this mirrors; each note says what to check if a name differs.
