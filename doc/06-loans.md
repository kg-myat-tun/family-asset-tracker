# Phase 6 — Loan Tracking

## Goal
Implement the full loan lifecycle: create a loan between two family members (any currency), record repayments (optionally in a different currency), track remaining balance, and detect overdue loans. All balance mutations use Firestore transactions to prevent race conditions.

---

## Step 1 — Loans lib (server)

```typescript
// src/lib/loans.server.ts
import "server-only";
import { adminDb } from "@/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { getCachedRates, convertAmount } from "@/lib/currency.server";
import type { Loan, Repayment, LoanStatus } from "@/types";

function docToLoan(doc: FirebaseFirestore.DocumentSnapshot): Loan {
  const d = doc.data()!;
  return {
    id: doc.id,
    lenderId: d.lenderId,
    borrowerId: d.borrowerId,
    currency: d.currency,
    principalAmount: d.principalAmount,
    remainingAmount: d.remainingAmount,
    interestRate: d.interestRate ?? null,
    description: d.description ?? "",
    status: d.status,
    dueDate: d.dueDate ? d.dueDate.toDate() : null,
    createdAt: d.createdAt.toDate(),
    updatedAt: d.updatedAt.toDate(),
  };
}

export async function getLoans(familyId: string, uid?: string): Promise<Loan[]> {
  let query = adminDb
    .collection(`families/${familyId}/loans`)
    .orderBy("createdAt", "desc") as FirebaseFirestore.Query;

  const snap = await query.get();
  const loans = snap.docs.map(docToLoan);

  // Filter client-side to avoid compound index requirement
  if (uid) return loans.filter((l) => l.lenderId === uid || l.borrowerId === uid);
  return loans;
}

export async function getLoan(familyId: string, loanId: string): Promise<Loan | null> {
  const snap = await adminDb.doc(`families/${familyId}/loans/${loanId}`).get();
  if (!snap.exists) return null;
  return docToLoan(snap);
}

export async function getRepayments(familyId: string, loanId: string): Promise<Repayment[]> {
  const snap = await adminDb
    .collection(`families/${familyId}/loans/${loanId}/repayments`)
    .orderBy("paidAt", "desc")
    .get();

  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      loanId,
      amount: d.amount,
      currency: d.currency,
      exchangeRateUsed: d.exchangeRateUsed ?? null,
      note: d.note ?? "",
      paidAt: d.paidAt.toDate(),
      recordedBy: d.recordedBy,
    };
  });
}

export async function createLoan(
  familyId: string,
  data: {
    lenderId: string;
    borrowerId: string;
    currency: string;
    principalAmount: number;
    interestRate?: number;
    description: string;
    dueDate?: Date;
  }
): Promise<string> {
  const ref = adminDb.collection(`families/${familyId}/loans`).doc();
  await ref.set({
    ...data,
    remainingAmount: data.principalAmount,
    status: "active" as LoanStatus,
    dueDate: data.dueDate ?? null,
    interestRate: data.interestRate ?? null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function recordRepayment(
  familyId: string,
  loanId: string,
  repayment: {
    amount: number;
    currency: string;
    note: string;
    recordedBy: string;
  }
): Promise<void> {
  const rates = await getCachedRates(familyId);

  await adminDb.runTransaction(async (tx) => {
    const loanRef = adminDb.doc(`families/${familyId}/loans/${loanId}`);
    const loanSnap = await tx.get(loanRef);
    if (!loanSnap.exists) throw new Error("Loan not found");

    const loan = docToLoan(loanSnap);
    if (loan.status === "settled") throw new Error("Loan already settled");

    // Convert repayment to loan's currency for balance tracking
    const amountInLoanCurrency = convertAmount(
      repayment.amount,
      repayment.currency,
      loan.currency,
      rates
    );

    // Calculate exchange rate used (repayment currency → loan currency)
    const exchangeRateUsed =
      repayment.currency === loan.currency
        ? 1
        : (rates[loan.currency] ?? 1) / (rates[repayment.currency] ?? 1);

    const newRemaining = Math.max(0, loan.remainingAmount - amountInLoanCurrency);
    const newStatus: LoanStatus =
      newRemaining <= 0
        ? "settled"
        : newRemaining < loan.principalAmount
        ? "partially_paid"
        : "active";

    // Update loan
    tx.update(loanRef, {
      remainingAmount: newRemaining,
      status: newStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Create repayment sub-document
    const repaymentRef = loanRef.collection("repayments").doc();
    tx.set(repaymentRef, {
      amount: repayment.amount,
      currency: repayment.currency,
      exchangeRateUsed,
      amountInLoanCurrency,
      note: repayment.note,
      recordedBy: repayment.recordedBy,
      paidAt: FieldValue.serverTimestamp(),
    });
  });
}

// Compute net balance between two users across all their loans
export function computeNetBalance(
  loans: Loan[],
  userAId: string,
  userBId: string,
  baseCurrency: string,
  rates: Record<string, number>
): number {
  // Positive = B owes A; Negative = A owes B
  return loans
    .filter(
      (l) =>
        (l.lenderId === userAId && l.borrowerId === userBId) ||
        (l.lenderId === userBId && l.borrowerId === userAId)
    )
    .filter((l) => l.status !== "settled")
    .reduce((sum, l) => {
      const remaining = convertAmount(l.remainingAmount, l.currency, baseCurrency, rates);
      return l.lenderId === userAId ? sum + remaining : sum - remaining;
    }, 0);
}
```

---

## Step 2 — Loan Server Actions

```typescript
// src/actions/loan.actions.ts
"use server";
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { createLoan, recordRepayment, getLoan } from "@/lib/loans.server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

async function getContextOrThrow() {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) throw new Error("No family");
  return { user, family };
}

const CreateLoanSchema = z.object({
  borrowerId: z.string().min(1, "Select a borrower"),
  currency: z.string().length(3),
  principalAmount: z.coerce.number().positive("Amount must be positive"),
  interestRate: z.coerce.number().min(0).max(100).optional(),
  description: z.string().min(1, "Description is required").max(300),
  dueDate: z.string().optional().transform((v) => (v ? new Date(v) : undefined)),
});

export async function createLoanAction(formData: FormData) {
  const { user, family } = await getContextOrThrow();

  const parsed = CreateLoanSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  if (parsed.data.borrowerId === user.uid) {
    return { errors: { borrowerId: ["You cannot lend to yourself"] } };
  }

  // Verify borrower is in the family
  const members = await getFamilyMembers(family.id);
  if (!members.find((m) => m.uid === parsed.data.borrowerId)) {
    return { errors: { borrowerId: ["Borrower is not in your family"] } };
  }

  const loanId = await createLoan(family.id, {
    lenderId: user.uid,
    ...parsed.data,
  });

  revalidatePath("/loans");
  redirect(`/loans/${loanId}`);
}

const RepaymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  currency: z.string().length(3),
  note: z.string().max(300).optional().default(""),
});

export async function recordRepaymentAction(loanId: string, formData: FormData) {
  const { user, family } = await getContextOrThrow();

  const loan = await getLoan(family.id, loanId);
  if (!loan) return { errors: { _: ["Loan not found"] } };

  // Only lender or borrower can record repayment
  if (loan.lenderId !== user.uid && loan.borrowerId !== user.uid) {
    return { errors: { _: ["Not authorized"] } };
  }

  const parsed = RepaymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  await recordRepayment(family.id, loanId, {
    ...parsed.data,
    recordedBy: user.uid,
  });

  revalidatePath(`/loans/${loanId}`);
  revalidatePath("/loans");
  redirect(`/loans/${loanId}`);
}
```

---

## Step 3 — Loans pages

```typescript
// src/app/(dashboard)/loans/page.tsx
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getLoans } from "@/lib/loans.server";
import { getCachedRates } from "@/lib/currency.server";
import { LoanList } from "@/components/loans/LoanList";
import Link from "next/link";

export default async function LoansPage({
  searchParams,
}: {
  searchParams: { tab?: "lent" | "owed" | "all" };
}) {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const [loans, members, rates] = await Promise.all([
    getLoans(family.id),
    getFamilyMembers(family.id),
    getCachedRates(family.id),
  ]);

  const tab = searchParams.tab ?? "all";
  const filtered =
    tab === "lent"
      ? loans.filter((l) => l.lenderId === user.uid)
      : tab === "owed"
      ? loans.filter((l) => l.borrowerId === user.uid)
      : loans;

  const memberMap = Object.fromEntries(members.map((m) => [m.uid, m]));
  const today = new Date();

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Loans</h1>
        <Link
          href="/loans/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          + New loan
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["all", "lent", "owed"] as const).map((t) => (
          <Link
            key={t}
            href={`/loans?tab=${t}`}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "lent" ? "I lent" : t === "owed" ? "I owe" : "All"}
          </Link>
        ))}
      </div>

      <LoanList
        loans={filtered}
        memberMap={memberMap}
        currentUid={user.uid}
        baseCurrency={family.baseCurrency}
        rates={rates}
        today={today}
      />
    </div>
  );
}
```

```typescript
// src/app/(dashboard)/loans/[loanId]/page.tsx
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getLoan, getRepayments } from "@/lib/loans.server";
import { getCachedRates, formatCurrency, convertAmount } from "@/lib/currency.server";
import { LoanDetail } from "@/components/loans/LoanDetail";
import { notFound } from "next/navigation";

export default async function LoanDetailPage({ params }: { params: { loanId: string } }) {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const [loan, repayments, members, rates] = await Promise.all([
    getLoan(family.id, params.loanId),
    getRepayments(family.id, params.loanId),
    getFamilyMembers(family.id),
    getCachedRates(family.id),
  ]);

  if (!loan) notFound();

  const memberMap = Object.fromEntries(members.map((m) => [m.uid, m]));
  const canAct = loan.lenderId === user.uid || loan.borrowerId === user.uid;

  return (
    <LoanDetail
      loan={loan}
      repayments={repayments}
      memberMap={memberMap}
      currentUid={user.uid}
      baseCurrency={family.baseCurrency}
      rates={rates}
      canAct={canAct}
    />
  );
}
```

---

## Step 4 — Loan components

```typescript
// src/components/loans/LoanList.tsx
import Link from "next/link";
import { formatCurrency, convertAmount } from "@/lib/currency.server";
import type { Loan, FamilyMember } from "@/types";

interface Props {
  loans: Loan[];
  memberMap: Record<string, FamilyMember>;
  currentUid: string;
  baseCurrency: string;
  rates: Record<string, number>;
  today: Date;
}

const STATUS_STYLES = {
  active: "bg-blue-50 text-blue-700",
  partially_paid: "bg-yellow-50 text-yellow-700",
  settled: "bg-green-50 text-green-700",
};

export function LoanList({ loans, memberMap, currentUid, baseCurrency, rates, today }: Props) {
  if (loans.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
        <p className="text-gray-400 text-4xl mb-3">🤝</p>
        <p className="text-gray-500">No loans yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {loans.map((loan) => {
        const isLender = loan.lenderId === currentUid;
        const otherUid = isLender ? loan.borrowerId : loan.lenderId;
        const other = memberMap[otherUid];
        const isOverdue =
          loan.dueDate && loan.dueDate < today && loan.status !== "settled";

        return (
          <Link key={loan.id} href={`/loans/${loan.id}`}>
            <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900 truncate">{loan.description}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[loan.status]}`}>
                      {loan.status.replace("_", " ")}
                    </span>
                    {isOverdue && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">
                        overdue
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {isLender ? "You lent to" : "You owe"}{" "}
                    <span className="font-medium text-gray-700">
                      {other?.displayName ?? "Unknown"}
                    </span>
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(loan.remainingAmount, loan.currency)}
                  </p>
                  {loan.currency !== baseCurrency && (
                    <p className="text-xs text-gray-400">
                      ≈ {formatCurrency(
                        convertAmount(loan.remainingAmount, loan.currency, baseCurrency, rates),
                        baseCurrency
                      )}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    of {formatCurrency(loan.principalAmount, loan.currency)}
                  </p>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
```

```typescript
// src/components/loans/RepaymentForm.tsx
"use client";
import { useActionState } from "react";
import { recordRepaymentAction } from "@/actions/loan.actions";

const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "THB", "JPY", "SGD", "AUD", "CAD"];

export function RepaymentForm({ loanId, loanCurrency }: { loanId: string; loanCurrency: string }) {
  const action = recordRepaymentAction.bind(null, loanId);
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4 bg-gray-50 rounded-xl p-4">
      <h3 className="font-medium text-gray-900">Record repayment</h3>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-sm text-gray-600 mb-1">Amount paid</label>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          {state?.errors?.amount && <p className="text-xs text-red-500 mt-1">{state.errors.amount[0]}</p>}
        </div>
        <div className="w-28">
          <label className="block text-sm text-gray-600 mb-1">Currency</label>
          <select
            name="currency"
            defaultValue={loanCurrency}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            {COMMON_CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-600 mb-1">Note (optional)</label>
        <input
          name="note"
          placeholder="e.g. Cash payment"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
      >
        {pending ? "Recording..." : "Record payment"}
      </button>
    </form>
  );
}
```

---

## Step 5 — LoanDetail component

```typescript
// src/components/loans/LoanDetail.tsx
import { formatCurrency, convertAmount } from "@/lib/currency.server";
import { RepaymentForm } from "./RepaymentForm";
import type { Loan, Repayment, FamilyMember } from "@/types";

interface Props {
  loan: Loan;
  repayments: Repayment[];
  memberMap: Record<string, FamilyMember>;
  currentUid: string;
  baseCurrency: string;
  rates: Record<string, number>;
  canAct: boolean;
}

export function LoanDetail({ loan, repayments, memberMap, currentUid, baseCurrency, rates, canAct }: Props) {
  const lender = memberMap[loan.lenderId];
  const borrower = memberMap[loan.borrowerId];
  const progressPct = ((loan.principalAmount - loan.remainingAmount) / loan.principalAmount) * 100;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">{loan.description}</h1>

        <div className="flex gap-8 text-sm">
          <div>
            <p className="text-gray-500">Lender</p>
            <p className="font-medium">{lender?.displayName ?? "Unknown"}</p>
          </div>
          <div>
            <p className="text-gray-500">Borrower</p>
            <p className="font-medium">{borrower?.displayName ?? "Unknown"}</p>
          </div>
          {loan.dueDate && (
            <div>
              <p className="text-gray-500">Due date</p>
              <p className="font-medium">{loan.dueDate.toLocaleDateString()}</p>
            </div>
          )}
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">Repaid</span>
            <span className="font-medium">
              {formatCurrency(loan.principalAmount - loan.remainingAmount, loan.currency)} of{" "}
              {formatCurrency(loan.principalAmount, loan.currency)}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Remaining: <span className="font-semibold text-gray-900">
              {formatCurrency(loan.remainingAmount, loan.currency)}
            </span>
            {loan.currency !== baseCurrency && (
              <span className="text-gray-400">
                {" "}≈ {formatCurrency(
                  convertAmount(loan.remainingAmount, loan.currency, baseCurrency, rates),
                  baseCurrency
                )}
              </span>
            )}
          </p>
        </div>
      </div>

      {canAct && loan.status !== "settled" && (
        <RepaymentForm loanId={loan.id} loanCurrency={loan.currency} />
      )}

      {repayments.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-medium text-gray-900">Repayment history</h2>
          {repayments.map((r) => (
            <div key={r.id} className="bg-white rounded-lg border border-gray-200 p-3 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">{formatCurrency(r.amount, r.currency)}</p>
                {r.note && <p className="text-xs text-gray-500">{r.note}</p>}
                <p className="text-xs text-gray-400">{r.paidAt.toLocaleDateString()}</p>
              </div>
              {r.currency !== loan.currency && r.exchangeRateUsed && (
                <p className="text-xs text-gray-400">
                  rate: {r.exchangeRateUsed.toFixed(4)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Verification

- [ ] Loan creation validates borrower is a different family member
- [ ] Loan appears correctly in "I lent" and "I owe" tabs for respective parties
- [ ] Repayment in the **same** currency as the loan: `remainingAmount` decreases correctly
- [ ] Repayment in a **different** currency: exchange rate is captured, amount is converted
- [ ] Repayment that covers full balance → status becomes `"settled"`
- [ ] Partial repayment → status becomes `"partially_paid"`
- [ ] Concurrent repayments don't corrupt `remainingAmount` (Firestore transaction)
- [ ] Overdue badge appears when `dueDate < today` and loan is not settled
- [ ] Progress bar fills proportionally to amount repaid
