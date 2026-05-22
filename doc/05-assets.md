# Phase 5 — Asset Management

## Goal
Full asset CRUD with multi-currency support, FX rate caching via Vercel Cron, file attachments via Firebase Storage, and converted totals displayed in the family's base currency.

---

## Step 1 — FX rate fetching & caching

```typescript
// src/lib/currency.server.ts
import "server-only";
import { adminDb } from "@/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import type { FxRates } from "@/types";

export async function getCachedRates(familyId: string): Promise<Record<string, number>> {
  const today = new Date().toISOString().split("T")[0];

  // Try today's rates
  const todaySnap = await adminDb.doc(`families/${familyId}/fxRates/${today}`).get();
  if (todaySnap.exists) return todaySnap.data()!.rates;

  // Fallback: find the most recent cached date
  const recentSnap = await adminDb
    .collection(`families/${familyId}/fxRates`)
    .orderBy("fetchedAt", "desc")
    .limit(1)
    .get();

  if (!recentSnap.empty) return recentSnap.docs[0].data().rates;

  // No cache at all — fetch live
  return fetchAndCacheRates(familyId);
}

export async function fetchAndCacheRates(familyId: string): Promise<Record<string, number>> {
  const res = await fetch("https://api.frankfurter.app/latest?base=USD", {
    next: { revalidate: 3600 }, // Next.js fetch cache: 1 hour
  });
  if (!res.ok) throw new Error("FX API unavailable");
  const { rates } = await res.json();
  rates.USD = 1; // ensure base is present

  const today = new Date().toISOString().split("T")[0];
  await adminDb.doc(`families/${familyId}/fxRates/${today}`).set({
    base: "USD",
    rates,
    fetchedAt: FieldValue.serverTimestamp(),
  });

  return rates;
}

export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>
): number {
  if (fromCurrency === toCurrency) return amount;
  const fromRate = rates[fromCurrency] ?? 1;
  const toRate = rates[toCurrency] ?? 1;
  return (amount / fromRate) * toRate;
}

export function formatCurrency(amount: number, currency: string, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
```

---

## Step 2 — Vercel Cron Route Handler (FX rates)

```typescript
// src/app/api/fx-rates/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

// Secured: only Vercel Cron or requests with CRON_SECRET can call this
export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch("https://api.frankfurter.app/latest?base=USD");
  if (!res.ok) return NextResponse.json({ error: "FX fetch failed" }, { status: 500 });

  const { rates } = await res.json();
  rates.USD = 1;

  const today = new Date().toISOString().split("T")[0];

  // Update rates for ALL families (fan-out)
  const familiesSnap = await adminDb.collection("families").get();
  const batch = adminDb.batch();
  for (const familyDoc of familiesSnap.docs) {
    const rateRef = adminDb.doc(`families/${familyDoc.id}/fxRates/${today}`);
    batch.set(rateRef, { base: "USD", rates, fetchedAt: FieldValue.serverTimestamp() });
  }
  await batch.commit();

  return NextResponse.json({ ok: true, date: today, currencies: Object.keys(rates).length });
}
```

Update `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/fx-rates?secret=YOUR_CRON_SECRET",
      "schedule": "0 1 * * *"
    }
  ]
}
```

---

## Step 3 — Assets lib (server)

```typescript
// src/lib/assets.server.ts
import "server-only";
import { adminDb } from "@/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import type { Asset, AssetCategory } from "@/types";

function docToAsset(doc: FirebaseFirestore.DocumentSnapshot): Asset {
  const d = doc.data()!;
  return {
    id: doc.id,
    ownerId: d.ownerId,
    name: d.name,
    category: d.category,
    currency: d.currency,
    amount: d.amount,
    description: d.description ?? "",
    attachmentURL: d.attachmentURL ?? null,
    deleted: d.deleted ?? false,
    createdAt: d.createdAt.toDate(),
    updatedAt: d.updatedAt.toDate(),
  };
}

export async function getAssets(familyId: string, ownerId?: string): Promise<Asset[]> {
  let query = adminDb
    .collection(`families/${familyId}/assets`)
    .where("deleted", "==", false)
    .orderBy("createdAt", "desc") as FirebaseFirestore.Query;

  if (ownerId) query = query.where("ownerId", "==", ownerId);

  const snap = await query.get();
  return snap.docs.map(docToAsset);
}

export async function getAsset(familyId: string, assetId: string): Promise<Asset | null> {
  const snap = await adminDb.doc(`families/${familyId}/assets/${assetId}`).get();
  if (!snap.exists || snap.data()!.deleted) return null;
  return docToAsset(snap);
}

export async function createAsset(
  familyId: string,
  ownerId: string,
  data: {
    name: string;
    category: AssetCategory;
    currency: string;
    amount: number;
    description: string;
    attachmentURL?: string;
  }
): Promise<string> {
  const ref = adminDb.collection(`families/${familyId}/assets`).doc();
  await ref.set({
    ...data,
    ownerId,
    deleted: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function updateAsset(
  familyId: string,
  assetId: string,
  data: Partial<Pick<Asset, "name" | "category" | "currency" | "amount" | "description" | "attachmentURL">>
): Promise<void> {
  await adminDb.doc(`families/${familyId}/assets/${assetId}`).update({
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function softDeleteAsset(familyId: string, assetId: string): Promise<void> {
  await adminDb.doc(`families/${familyId}/assets/${assetId}`).update({
    deleted: true,
    updatedAt: FieldValue.serverTimestamp(),
  });
}
```

---

## Step 4 — Asset Server Actions

```typescript
// src/actions/asset.actions.ts
"use server";
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { createAsset, updateAsset, softDeleteAsset, getAsset } from "@/lib/assets.server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const AssetSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  category: z.enum(["cash", "bank", "investment", "property", "crypto", "other"]),
  currency: z.string().length(3, "Invalid currency"),
  amount: z.coerce.number().positive("Amount must be positive"),
  description: z.string().max(500).optional().default(""),
  attachmentURL: z.string().url().optional().or(z.literal("")),
});

async function getContextOrThrow() {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) throw new Error("No family found");
  return { user, family };
}

export async function createAssetAction(formData: FormData) {
  const { user, family } = await getContextOrThrow();

  const parsed = AssetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const assetId = await createAsset(family.id, user.uid, {
    ...parsed.data,
    attachmentURL: parsed.data.attachmentURL || undefined,
  });

  revalidatePath("/assets");
  redirect(`/assets/${assetId}`);
}

export async function updateAssetAction(assetId: string, formData: FormData) {
  const { user, family } = await getContextOrThrow();

  // Ownership check
  const existing = await getAsset(family.id, assetId);
  if (!existing) return { errors: { _: ["Asset not found"] } };

  const members = await getFamilyMembers(family.id);
  const self = members.find((m) => m.uid === user.uid);
  if (existing.ownerId !== user.uid && self?.role !== "admin") {
    return { errors: { _: ["Not authorized"] } };
  }

  const parsed = AssetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  await updateAsset(family.id, assetId, {
    ...parsed.data,
    attachmentURL: parsed.data.attachmentURL || undefined,
  });

  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  redirect(`/assets/${assetId}`);
}

export async function deleteAssetAction(assetId: string) {
  const { user, family } = await getContextOrThrow();

  const existing = await getAsset(family.id, assetId);
  if (!existing) return { error: "Not found" };

  const members = await getFamilyMembers(family.id);
  const self = members.find((m) => m.uid === user.uid);
  if (existing.ownerId !== user.uid && self?.role !== "admin") {
    return { error: "Not authorized" };
  }

  await softDeleteAsset(family.id, assetId);
  revalidatePath("/assets");
  redirect("/assets");
}
```

---

## Step 5 — Assets pages

```typescript
// src/app/(dashboard)/assets/page.tsx
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser } from "@/lib/family.server";
import { getAssets } from "@/lib/assets.server";
import { getCachedRates, convertAmount, formatCurrency } from "@/lib/currency.server";
import { AssetList } from "@/components/assets/AssetList";
import Link from "next/link";

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: { owner?: string; category?: string };
}) {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const [assets, rates] = await Promise.all([
    getAssets(family.id, searchParams.owner),
    getCachedRates(family.id),
  ]);

  const filtered = searchParams.category
    ? assets.filter((a) => a.category === searchParams.category)
    : assets;

  const totalInBase = filtered.reduce(
    (sum, a) => sum + convertAmount(a.amount, a.currency, family.baseCurrency, rates),
    0
  );

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Assets</h1>
          <p className="text-sm text-gray-500 mt-1">
            Total: {formatCurrency(totalInBase, family.baseCurrency)}
          </p>
        </div>
        <Link
          href="/assets/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          + Add asset
        </Link>
      </div>
      <AssetList assets={filtered} baseCurrency={family.baseCurrency} rates={rates} />
    </div>
  );
}
```

```typescript
// src/app/(dashboard)/assets/new/page.tsx
import { AssetForm } from "@/components/assets/AssetForm";
import { createAssetAction } from "@/actions/asset.actions";

export default function NewAssetPage() {
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Add asset</h1>
      <AssetForm action={createAssetAction} />
    </div>
  );
}
```

---

## Step 6 — Asset components

```typescript
// src/components/assets/AssetForm.tsx
"use client";
import { useActionState } from "react";
import type { Asset } from "@/types";

const CATEGORIES = ["cash", "bank", "investment", "property", "crypto", "other"] as const;
const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "THB", "JPY", "SGD", "AUD", "CAD", "CNY", "HKD", "KRW"];

interface Props {
  action: (formData: FormData) => Promise<{ errors?: Record<string, string[]> } | void>;
  defaultValues?: Partial<Asset>;
}

export function AssetForm({ action, defaultValues }: Props) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          name="name"
          defaultValue={defaultValues?.name}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {state?.errors?.name && <p className="text-sm text-red-500 mt-1">{state.errors.name[0]}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select
          name="category"
          defaultValue={defaultValues?.category ?? "cash"}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValues?.amount}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
          {state?.errors?.amount && <p className="text-sm text-red-500 mt-1">{state.errors.amount[0]}</p>}
        </div>
        <div className="w-32">
          <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
          <select
            name="currency"
            defaultValue={defaultValues?.currency ?? "USD"}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          >
            {COMMON_CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
        <textarea
          name="description"
          defaultValue={defaultValues?.description}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save asset"}
      </button>
    </form>
  );
}
```

```typescript
// src/components/assets/AssetList.tsx
import { convertAmount, formatCurrency } from "@/lib/currency.server";
import type { Asset } from "@/types";
import Link from "next/link";

const CATEGORY_ICONS: Record<string, string> = {
  cash: "💵", bank: "🏦", investment: "📈", property: "🏠", crypto: "₿", other: "📦",
};

interface Props {
  assets: Asset[];
  baseCurrency: string;
  rates: Record<string, number>;
}

export function AssetList({ assets, baseCurrency, rates }: Props) {
  if (assets.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
        <p className="text-gray-400 text-4xl mb-3">💰</p>
        <p className="text-gray-500">No assets yet. Add your first one.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {assets.map((asset) => {
        const converted = convertAmount(asset.amount, asset.currency, baseCurrency, rates);
        return (
          <Link key={asset.id} href={`/assets/${asset.id}`}>
            <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition-colors flex items-center gap-4">
              <span className="text-2xl">{CATEGORY_ICONS[asset.category]}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{asset.name}</p>
                <p className="text-sm text-gray-500 capitalize">{asset.category}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-semibold text-gray-900">
                  {formatCurrency(asset.amount, asset.currency)}
                </p>
                {asset.currency !== baseCurrency && (
                  <p className="text-xs text-gray-400">
                    ≈ {formatCurrency(converted, baseCurrency)}
                  </p>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
```

---

## Verification

- [ ] Assets page lists all non-deleted assets with converted totals
- [ ] Creating an asset persists to Firestore and redirects to the detail page
- [ ] Editing an asset works for owner and admin; non-owner member cannot edit
- [ ] Soft delete sets `deleted: true` — asset disappears from list but remains in Firestore
- [ ] FX rates are fetched from Frankfurter API and cached in Firestore on first load
- [ ] `GET /api/fx-rates?secret=...` works and updates rates for all families
- [ ] Currency amounts display correctly using `Intl.NumberFormat`
- [ ] Loading skeleton appears while data fetches
