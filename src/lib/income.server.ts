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
