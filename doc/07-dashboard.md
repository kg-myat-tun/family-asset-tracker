# Phase 7 — Dashboard Overview

## Goal
Build the overview page: total family net worth, per-member asset breakdown, outstanding loans summary, and a real-time activity feed using Firestore `onSnapshot`. This phase also wires up Recharts for visualizations.

---

## Step 1 — Dashboard data aggregation (server)

```typescript
// src/lib/dashboard.server.ts
import "server-only";
import { adminDb } from "@/firebase/admin";
import { getCachedRates, convertAmount } from "@/lib/currency.server";
import type { Asset, Loan, FamilyMember } from "@/types";

export interface MemberSummary {
  member: FamilyMember;
  totalInBase: number;
  assetCount: number;
}

export interface DashboardData {
  totalNetWorth: number;
  memberSummaries: MemberSummary[];
  activeLoans: Loan[];
  overdueLoans: Loan[];
  recentAssets: Asset[];
}

export async function getDashboardData(
  familyId: string,
  members: FamilyMember[],
  baseCurrency: string
): Promise<DashboardData> {
  const rates = await getCachedRates(familyId);
  const today = new Date();

  const [assetsSnap, loansSnap] = await Promise.all([
    adminDb
      .collection(`families/${familyId}/assets`)
      .where("deleted", "==", false)
      .orderBy("createdAt", "desc")
      .get(),
    adminDb
      .collection(`families/${familyId}/loans`)
      .where("status", "!=", "settled")
      .get(),
  ]);

  const assets: Asset[] = assetsSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      ownerId: d.ownerId,
      name: d.name,
      category: d.category,
      currency: d.currency,
      amount: d.amount,
      description: d.description ?? "",
      attachmentURL: d.attachmentURL ?? null,
      deleted: false,
      createdAt: d.createdAt.toDate(),
      updatedAt: d.updatedAt.toDate(),
    };
  });

  const activeLoans: Loan[] = loansSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      lenderId: d.lenderId,
      borrowerId: d.borrowerId,
      currency: d.currency,
      principalAmount: d.principalAmount,
      remainingAmount: d.remainingAmount,
      interestRate: d.interestRate ?? null,
      description: d.description,
      status: d.status,
      dueDate: d.dueDate ? d.dueDate.toDate() : null,
      createdAt: d.createdAt.toDate(),
      updatedAt: d.updatedAt.toDate(),
    };
  });

  // Per-member asset totals
  const memberSummaries: MemberSummary[] = members.map((member) => {
    const memberAssets = assets.filter((a) => a.ownerId === member.uid);
    const totalInBase = memberAssets.reduce(
      (sum, a) => sum + convertAmount(a.amount, a.currency, baseCurrency, rates),
      0
    );
    return { member, totalInBase, assetCount: memberAssets.length };
  });

  const totalNetWorth = memberSummaries.reduce((sum, s) => sum + s.totalInBase, 0);
  const overdueLoans = activeLoans.filter((l) => l.dueDate && l.dueDate < today);
  const recentAssets = assets.slice(0, 5);

  return { totalNetWorth, memberSummaries, activeLoans, overdueLoans, recentAssets };
}
```

---

## Step 2 — Dashboard page (Server Component)

```typescript
// src/app/(dashboard)/page.tsx
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getDashboardData } from "@/lib/dashboard.server";
import { formatCurrency } from "@/lib/currency.server";
import { NetWorthChart } from "@/components/dashboard/NetWorthChart";
import { LoanAlerts } from "@/components/dashboard/LoanAlerts";
import { RecentAssets } from "@/components/dashboard/RecentAssets";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";

export default async function DashboardPage() {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const members = await getFamilyMembers(family.id);
  const data = await getDashboardData(family.id, members, family.baseCurrency);

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Net worth hero */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <p className="text-sm text-gray-500 mb-1">Total family net worth</p>
        <p className="text-4xl font-bold text-gray-900">
          {formatCurrency(data.totalNetWorth, family.baseCurrency)}
        </p>
        <p className="text-sm text-gray-400 mt-1">{family.baseCurrency} equivalent</p>
      </div>

      {/* Overdue alerts */}
      {data.overdueLoans.length > 0 && (
        <LoanAlerts loans={data.overdueLoans} members={members} />
      )}

      {/* Charts + summary grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Assets by member</h2>
          <NetWorthChart
            data={data.memberSummaries.map((s) => ({
              name: s.member.displayName,
              value: s.totalInBase,
            }))}
            currency={family.baseCurrency}
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Outstanding loans</h2>
          <div className="space-y-2">
            {data.activeLoans.length === 0 ? (
              <p className="text-gray-400 text-sm">No outstanding loans 🎉</p>
            ) : (
              data.activeLoans.slice(0, 5).map((loan) => {
                const lender = members.find((m) => m.uid === loan.lenderId);
                const borrower = members.find((m) => m.uid === loan.borrowerId);
                return (
                  <div key={loan.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {lender?.displayName} → {borrower?.displayName}
                    </span>
                    <span className="font-medium">
                      {formatCurrency(loan.remainingAmount, loan.currency)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Recent assets + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentAssets assets={data.recentAssets} />
        <ActivityFeed familyId={family.id} />
      </div>
    </div>
  );
}
```

---

## Step 3 — NetWorthChart (Client Component using Recharts)

```typescript
// src/components/dashboard/NetWorthChart.tsx
"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

interface Props {
  data: { name: string; value: number }[];
  currency: string;
}

export function NetWorthChart({ data, currency }: Props) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <p className="text-gray-400 text-sm">No asset data yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={(v) =>
            new Intl.NumberFormat("en-US", {
              notation: "compact",
              currency,
              style: "currency",
            }).format(v)
          }
        />
        <Tooltip
          formatter={(value: number) =>
            new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value)
          }
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
```

---

## Step 4 — ActivityFeed (real-time, Client Component)

The activity feed uses Firestore `onSnapshot` for live updates when family members make changes.

```typescript
// src/components/dashboard/ActivityFeed.tsx
"use client";
import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/firebase/client";

interface ActivityItem {
  id: string;
  type: "asset_added" | "asset_updated" | "loan_created" | "repayment_made";
  description: string;
  createdAt: Date;
}

// Activity items are written by Server Actions to a `activity` subcollection
// Each action should call: adminDb.collection(`families/${familyId}/activity`).add({...})

export function ActivityFeed({ familyId }: { familyId: string }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, `families/${familyId}/activity`),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setItems(
        snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: (doc.data().createdAt as Timestamp).toDate(),
        })) as ActivityItem[]
      );
      setLoading(false);
    });

    return () => unsubscribe();
  }, [familyId]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-4 bg-gray-100 rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h2 className="font-semibold text-gray-900 mb-4">Recent activity</h2>
      {items.length === 0 ? (
        <p className="text-gray-400 text-sm">No activity yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3 items-start">
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-700">{item.description}</p>
                <p className="text-xs text-gray-400">
                  {item.createdAt.toLocaleDateString()} at{" "}
                  {item.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Wire activity writes into Server Actions** — add this helper and call it at the end of `createAsset`, `createLoan`, `recordRepayment`:

```typescript
// src/lib/activity.server.ts
import "server-only";
import { adminDb } from "@/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export async function logActivity(
  familyId: string,
  description: string,
  type: string
): Promise<void> {
  await adminDb.collection(`families/${familyId}/activity`).add({
    type,
    description,
    createdAt: FieldValue.serverTimestamp(),
  });
}
```

---

## Step 5 — Supporting components

```typescript
// src/components/dashboard/LoanAlerts.tsx
import Link from "next/link";
import type { Loan, FamilyMember } from "@/types";

export function LoanAlerts({ loans, members }: { loans: Loan[]; members: FamilyMember[] }) {
  const memberMap = Object.fromEntries(members.map((m) => [m.uid, m]));

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
      <p className="text-sm font-semibold text-red-700">⚠️ Overdue loans</p>
      {loans.map((loan) => (
        <Link key={loan.id} href={`/loans/${loan.id}`} className="block text-sm text-red-600 hover:underline">
          {memberMap[loan.lenderId]?.displayName} → {memberMap[loan.borrowerId]?.displayName}:{" "}
          {loan.remainingAmount} {loan.currency} (due {loan.dueDate?.toLocaleDateString()})
        </Link>
      ))}
    </div>
  );
}
```

```typescript
// src/components/dashboard/RecentAssets.tsx
import Link from "next/link";
import { formatCurrency } from "@/lib/currency.server";
import type { Asset } from "@/types";

export function RecentAssets({ assets }: { assets: Asset[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Recent assets</h2>
        <Link href="/assets" className="text-sm text-blue-600 hover:underline">View all</Link>
      </div>
      {assets.length === 0 ? (
        <p className="text-gray-400 text-sm">No assets yet.</p>
      ) : (
        <div className="space-y-2">
          {assets.map((a) => (
            <Link key={a.id} href={`/assets/${a.id}`} className="flex justify-between text-sm hover:text-blue-600">
              <span className="text-gray-700 truncate">{a.name}</span>
              <span className="font-medium ml-4 flex-shrink-0">{formatCurrency(a.amount, a.currency)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Verification

- [ ] Dashboard shows total net worth aggregated from all members' assets
- [ ] `NetWorthChart` renders a bar per member with correct values
- [ ] Overdue loans show the red alert banner
- [ ] `ActivityFeed` updates in real time when another family member adds an asset or records a repayment (test with two browser tabs)
- [ ] Recent assets section links correctly to asset detail pages
- [ ] `logActivity` is called after `createAsset`, `createLoan`, `recordRepayment`
