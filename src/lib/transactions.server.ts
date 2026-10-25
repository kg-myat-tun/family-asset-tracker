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
      | "name"
      | "category"
      | "customLabel"
      | "currency"
      | "amount"
      | "date"
      | "description"
      | "visibility"
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
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  const snap = await getAdminDb()
    .collection(`families/${familyId}/transactions`)
    .where("date", ">=", start)
    .where("date", "<", end)
    .get();

  return snap.docs
    .map(docToTransaction)
    .filter((t) => !t.deleted && canViewTransaction(t, viewerUid));
}
