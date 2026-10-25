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

// A rule's month-based cadence stays on the day of the month it was created
// (nextDueDate is seeded from the creation time), even after a short month
// clamps one occurrence to an earlier day.
function anchorDayOf(rule: RecurringRule): number {
  return rule.createdAt.getUTCDate();
}

// Caps how many missed occurrences one rule may post in a single run, keeping
// each batch well under Firestore's 500-write limit. Anything left over posts
// on the next run.
const MAX_OCCURRENCES_PER_RUN = 100;

// Posts a dated Transaction for every due occurrence of every active
// RecurringRule, then advances nextDueDate past today. If the cron missed
// runs, all overdue occurrences post in this run (each with its own date)
// rather than one per day. Returns the dates posted, so the caller can
// refresh the monthly summaries those dates fall in. The equality filters
// below (deleted, active) are safe without a composite index; nextDueDate is
// compared in application code rather than as a third Firestore range filter,
// avoiding the equality+range-on-different-field combination that would
// require one (see Global Constraints). Advancing nextDueDate in the same
// batch as the postings makes this idempotent: a retried/delayed cron run
// cannot double-post a rule for the same period.
export async function postDueRecurringTransactions(familyId: string): Promise<Date[]> {
  const db = getAdminDb();
  const today = new Date();
  const snap = await db
    .collection(`families/${familyId}/recurringRules`)
    .where("deleted", "==", false)
    .where("active", "==", true)
    .get();

  const dueRules = snap.docs.map(docToRecurringRule).filter((rule) => rule.nextDueDate <= today);

  const postedDates: Date[] = [];
  for (const rule of dueRules) {
    const batch = db.batch();
    const posted: { id: string; date: Date }[] = [];
    let dueDate = rule.nextDueDate;
    while (dueDate <= today && posted.length < MAX_OCCURRENCES_PER_RUN) {
      const txRef = db.collection(`families/${familyId}/transactions`).doc();
      batch.set(txRef, {
        ownerId: rule.ownerId,
        type: rule.type,
        name: rule.name,
        category: rule.category,
        customLabel: rule.customLabel,
        currency: rule.currency,
        amount: rule.amount,
        date: dueDate,
        recurringRuleId: rule.id,
        description: "",
        visibility: rule.visibility,
        deleted: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      posted.push({ id: txRef.id, date: dueDate });
      dueDate = nextDueDateAfter(dueDate, rule.frequency, anchorDayOf(rule));
    }
    batch.update(db.doc(`families/${familyId}/recurringRules/${rule.id}`), {
      nextDueDate: dueDate,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
    postedDates.push(...posted.map((p) => p.date));

    if (rule.visibility === "shared") {
      for (const p of posted) {
        await logActivity(
          familyId,
          "transaction_added",
          `${rule.name} (${formatCurrency(rule.amount, rule.currency)}) posted`,
          rule.visibility,
          p.id,
        );
      }
    }
  }
  return postedDates;
}

// Pauses or resumes a rule. Resuming skips the occurrences that fell due while
// paused: nextDueDate moves to the first occurrence after now, so the cron
// doesn't backfill transactions the user meant to skip.
export async function setRecurringRuleActive(
  familyId: string,
  rule: RecurringRule,
  active: boolean,
): Promise<void> {
  const update: { active: boolean; nextDueDate?: Date } = { active };
  if (active && !rule.active) {
    const now = new Date();
    let dueDate = rule.nextDueDate;
    while (dueDate <= now) dueDate = nextDueDateAfter(dueDate, rule.frequency, anchorDayOf(rule));
    update.nextDueDate = dueDate;
  }
  await getAdminDb()
    .doc(`families/${familyId}/recurringRules/${rule.id}`)
    .update({ ...update, updatedAt: FieldValue.serverTimestamp() });
}
