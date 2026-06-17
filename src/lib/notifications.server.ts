import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/firebase/admin";
import { formatCurrency } from "@/lib/currency.server";
import { getFamilyMembers } from "@/lib/family.server";
import { liveLoanState } from "@/lib/loan-interest";
import { borrowerName, lenderName } from "@/lib/loan-party";
import { getLoans } from "@/lib/loans.server";
import type { Loan, NotificationType } from "@/types";

// A loan is flagged "due soon" when its due date is within this many days.
const DUE_SOON_WINDOW_DAYS = 7;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Classify a loan against today. Returns the reminder type, or null when the
 * loan is settled, has no due date, or is not yet within the reminder window.
 */
function classify(loan: Loan, now: Date): NotificationType | null {
  if (loan.status === "settled" || !loan.dueDate) return null;
  const daysUntil = Math.round((startOfDay(loan.dueDate) - startOfDay(now)) / MS_PER_DAY);
  if (daysUntil < 0) return "loan_overdue";
  if (daysUntil <= DUE_SOON_WINDOW_DAYS) return "loan_due_soon";
  return null;
}

function buildMessage(
  loan: Loan,
  type: NotificationType,
  recipientUid: string,
  memberMap: Record<string, { displayName: string }>,
): { title: string; body: string } {
  const owed = formatCurrency(liveLoanState(loan).totalOwed, loan.currency);
  const isLender = loan.lenderId === recipientUid;
  const stake = isLender
    ? `${borrowerName(loan, memberMap)} owes you ${owed}`
    : `You owe ${owed} to ${lenderName(loan, memberMap)}`;
  const when =
    type === "loan_overdue"
      ? `was due ${loan.dueDate?.toLocaleDateString()}`
      : `is due ${loan.dueDate?.toLocaleDateString()}`;
  return {
    title: type === "loan_overdue" ? "Payment overdue" : "Payment due soon",
    body: `${loan.description}: ${stake} — ${when}`,
  };
}

interface Candidate {
  id: string;
  recipientUid: string;
  loanId: string;
  type: NotificationType;
  title: string;
  body: string;
  dueDate: Date;
}

/**
 * Daily reminder sweep: scans every family's loans and creates one in-app
 * notification per recipient for each due-soon or overdue loan. The doc ID is
 * deterministic (recipient + loan + type + due date) so repeated runs are
 * idempotent — a reminder fires once per due date and is never duplicated.
 */
export async function generateReminders(now: Date = new Date()): Promise<{ created: number }> {
  const db = getAdminDb();
  const familiesSnap = await db.collection("families").get();
  let created = 0;

  for (const familyDoc of familiesSnap.docs) {
    const familyId = familyDoc.id;
    const [loans, members] = await Promise.all([getLoans(familyId), getFamilyMembers(familyId)]);
    const memberMap = Object.fromEntries(members.map((m) => [m.uid, m]));

    const candidates: Candidate[] = [];
    for (const loan of loans) {
      const type = classify(loan, now);
      if (!type || !loan.dueDate) continue;

      // Notify each participant who is a family member (external parties have no uid).
      const recipients = [loan.lenderId, loan.borrowerId].filter(
        (uid): uid is string => !!uid && !!memberMap[uid],
      );
      for (const recipientUid of recipients) {
        const { title, body } = buildMessage(loan, type, recipientUid, memberMap);
        candidates.push({
          id: `${recipientUid}_${loan.id}_${type}_${loan.dueDate.getTime()}`,
          recipientUid,
          loanId: loan.id,
          type,
          title,
          body,
          dueDate: loan.dueDate,
        });
      }
    }

    if (candidates.length === 0) continue;

    // Only create notifications that don't already exist, so we never overwrite
    // a notification the user has already read.
    const col = db.collection(`families/${familyId}/notifications`);
    const existing = await db.getAll(...candidates.map((c) => col.doc(c.id)));
    const missing = candidates.filter((_, i) => !existing[i].exists);
    if (missing.length === 0) continue;

    const batch = db.batch();
    for (const c of missing) {
      batch.set(col.doc(c.id), {
        recipientUid: c.recipientUid,
        loanId: c.loanId,
        type: c.type,
        title: c.title,
        body: c.body,
        dueDate: c.dueDate,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    created += missing.length;
  }

  return { created };
}

export async function markNotificationRead(
  familyId: string,
  uid: string,
  notifId: string,
): Promise<void> {
  const ref = getAdminDb().doc(`families/${familyId}/notifications/${notifId}`);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.recipientUid !== uid) return;
  await ref.update({ read: true });
}

export async function markAllNotificationsRead(familyId: string, uid: string): Promise<void> {
  const db = getAdminDb();
  const snap = await db
    .collection(`families/${familyId}/notifications`)
    .where("recipientUid", "==", uid)
    .where("read", "==", false)
    .get();
  if (snap.empty) return;

  const batch = db.batch();
  for (const doc of snap.docs) batch.update(doc.ref, { read: true });
  await batch.commit();
}
