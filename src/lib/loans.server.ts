import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/firebase/admin";
import { convertAmount, getCachedRates } from "@/lib/currency.server";
import type { Loan, LoanStatus, Repayment } from "@/types";

function docToLoan(doc: FirebaseFirestore.DocumentSnapshot): Loan {
  const d = doc.data();
  if (!d) throw new Error("Loan doc empty");
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
  const snap = await getAdminDb()
    .collection(`families/${familyId}/loans`)
    .orderBy("createdAt", "desc")
    .get();

  const loans = snap.docs.map(docToLoan);
  if (uid) return loans.filter((l) => l.lenderId === uid || l.borrowerId === uid);
  return loans;
}

export async function getLoan(familyId: string, loanId: string): Promise<Loan | null> {
  const snap = await getAdminDb().doc(`families/${familyId}/loans/${loanId}`).get();
  if (!snap.exists) return null;
  return docToLoan(snap);
}

export async function getRepayments(familyId: string, loanId: string): Promise<Repayment[]> {
  const snap = await getAdminDb()
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
  },
): Promise<string> {
  const ref = getAdminDb().collection(`families/${familyId}/loans`).doc();
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
  },
): Promise<void> {
  const rates = await getCachedRates(familyId);
  const db = getAdminDb();

  await db.runTransaction(async (tx) => {
    const loanRef = db.doc(`families/${familyId}/loans/${loanId}`);
    const loanSnap = await tx.get(loanRef);
    if (!loanSnap.exists) throw new Error("Loan not found");

    const loan = docToLoan(loanSnap);
    if (loan.status === "settled") throw new Error("Loan already settled");

    const amountInLoanCurrency = convertAmount(
      repayment.amount,
      repayment.currency,
      loan.currency,
      rates,
    );

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

    tx.update(loanRef, {
      remainingAmount: newRemaining,
      status: newStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });

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

export function computeNetBalance(
  loans: Loan[],
  userAId: string,
  userBId: string,
  baseCurrency: string,
  rates: Record<string, number>,
): number {
  return loans
    .filter(
      (l) =>
        (l.lenderId === userAId && l.borrowerId === userBId) ||
        (l.lenderId === userBId && l.borrowerId === userAId),
    )
    .filter((l) => l.status !== "settled")
    .reduce((sum, l) => {
      const remaining = convertAmount(l.remainingAmount, l.currency, baseCurrency, rates);
      return l.lenderId === userAId ? sum + remaining : sum - remaining;
    }, 0);
}
