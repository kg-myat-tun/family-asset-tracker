import "server-only";

import { FieldValue, type Query } from "firebase-admin/firestore";
import { getAdminDb } from "@/firebase/admin";
import { logActivity } from "@/lib/activity.server";
import { nextDueDateAfter } from "@/lib/cashflow";
import { formatCurrency } from "@/lib/currency.server";
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

    if (rule.visibility === "shared") {
      await logActivity(
        familyId,
        "transaction_added",
        `${rule.name} (${formatCurrency(rule.amount, rule.currency)}) posted`,
        rule.visibility,
        txRef.id,
      );
    }
  }
  return posted;
}
