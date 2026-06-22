import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/firebase/admin";
import { convertAmount, getCachedRates } from "@/lib/currency.server";
import { accrue, liveLoanState } from "@/lib/loan-interest";
import type { CompoundingPeriod, Loan, LoanStatus, Repayment, Visibility } from "@/types";

function docToLoan(doc: FirebaseFirestore.DocumentSnapshot): Loan {
  const d = doc.data();
  if (!d) throw new Error("Loan doc empty");
  const createdAt = d.createdAt.toDate();
  // Legacy loans predate interest fields: default to no compounding so a
  // stored-but-unused rate never silently back-charges. remainingAmount was
  // principal-not-yet-repaid, so it doubles as the initial principalOutstanding.
  return {
    id: doc.id,
    lenderId: d.lenderId ?? null,
    borrowerId: d.borrowerId ?? null,
    lenderName: d.lenderName ?? null,
    borrowerName: d.borrowerName ?? null,
    visibility: d.visibility ?? "shared",
    currency: d.currency,
    principalAmount: d.principalAmount,
    remainingAmount: d.remainingAmount,
    interestRate: d.interestRate ?? null,
    compoundingPeriod: (d.compoundingPeriod ?? "none") as CompoundingPeriod,
    installmentCount: d.installmentCount ?? null,
    firstPaymentDate: d.firstPaymentDate ? d.firstPaymentDate.toDate() : null,
    interestStartDate: d.interestStartDate ? d.interestStartDate.toDate() : createdAt,
    principalOutstanding: d.principalOutstanding ?? d.remainingAmount,
    accruedInterestSnapshot: d.accruedInterestSnapshot ?? 0,
    lastEventDate: d.lastEventDate ? d.lastEventDate.toDate() : createdAt,
    description: d.description ?? "",
    status: d.status,
    dueDate: d.dueDate ? d.dueDate.toDate() : null,
    createdAt,
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
      principalPortion: d.principalPortion ?? d.amountInLoanCurrency ?? d.amount,
      interestPortion: d.interestPortion ?? 0,
      note: d.note ?? "",
      paidAt: d.paidAt.toDate(),
      recordedBy: d.recordedBy,
    };
  });
}

export async function createLoan(
  familyId: string,
  data: {
    lenderId: string | null;
    borrowerId: string | null;
    lenderName?: string | null;
    borrowerName?: string | null;
    visibility: Visibility;
    currency: string;
    principalAmount: number;
    interestRate?: number;
    compoundingPeriod?: CompoundingPeriod;
    installmentCount?: number;
    firstPaymentDate?: Date;
    description: string;
    dueDate?: Date;
  },
): Promise<string> {
  const ref = getAdminDb().collection(`families/${familyId}/loans`).doc();
  const now = FieldValue.serverTimestamp();
  // Interest only accrues when both a rate and a compounding period are set.
  const compoundingPeriod: CompoundingPeriod =
    data.interestRate && data.compoundingPeriod ? data.compoundingPeriod : "none";
  await ref.set({
    ...data,
    lenderId: data.lenderId ?? null,
    borrowerId: data.borrowerId ?? null,
    lenderName: data.lenderName ?? null,
    borrowerName: data.borrowerName ?? null,
    remainingAmount: data.principalAmount,
    principalOutstanding: data.principalAmount,
    accruedInterestSnapshot: 0,
    compoundingPeriod,
    installmentCount: data.installmentCount ?? null,
    firstPaymentDate: data.firstPaymentDate ?? null,
    interestStartDate: now,
    lastEventDate: now,
    status: "active" as LoanStatus,
    dueDate: data.dueDate ?? null,
    interestRate: data.interestRate ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateLoan(
  familyId: string,
  loanId: string,
  data: {
    description: string;
    visibility: Visibility;
    dueDate: Date | null;
    interestRate: number | null;
    compoundingPeriod: CompoundingPeriod;
    installmentCount: number | null;
    firstPaymentDate: Date | null;
    // Only honoured when the loan has no repayments yet (enforced by caller).
    principalAmount?: number;
    currency?: string;
  },
): Promise<void> {
  const db = getAdminDb();
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`families/${familyId}/loans/${loanId}`);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("Loan not found");
    const loan = docToLoan(snap);

    const update: Record<string, unknown> = {
      description: data.description,
      visibility: data.visibility,
      dueDate: data.dueDate ?? null,
      interestRate: data.interestRate,
      compoundingPeriod: data.compoundingPeriod,
      installmentCount: data.installmentCount,
      firstPaymentDate: data.firstPaymentDate,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // If the interest terms change, freeze interest accrued under the old terms
    // up to now so the new rate only applies going forward, not retroactively.
    const termsChanged =
      data.interestRate !== loan.interestRate || data.compoundingPeriod !== loan.compoundingPeriod;
    if (termsChanged) {
      const now = new Date();
      const frozen =
        loan.accruedInterestSnapshot +
        accrue(
          loan.principalOutstanding + loan.accruedInterestSnapshot,
          loan.interestRate,
          loan.compoundingPeriod,
          loan.lastEventDate,
          now,
        );
      update.accruedInterestSnapshot = frozen;
      update.lastEventDate = now;
      update.remainingAmount = loan.principalOutstanding + frozen;
    }

    // Principal/currency are only adjustable before any repayment exists. When
    // the principal changes the loan resets to a fresh, untouched balance.
    if (data.principalAmount !== undefined) {
      update.principalAmount = data.principalAmount;
      update.principalOutstanding = data.principalAmount;
      update.accruedInterestSnapshot = 0;
      update.lastEventDate = new Date();
      update.remainingAmount = data.principalAmount;
    }
    if (data.currency !== undefined) update.currency = data.currency;

    tx.update(ref, update);
  });
}

export async function deleteLoan(familyId: string, loanId: string): Promise<void> {
  const db = getAdminDb();
  const loanRef = db.doc(`families/${familyId}/loans/${loanId}`);
  const repayments = await loanRef.collection("repayments").get();

  const batch = db.batch();
  for (const doc of repayments.docs) batch.delete(doc.ref);
  batch.delete(loanRef);
  await batch.commit();
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

    // Accrue interest up to now, then apply the payment interest-first.
    const paidAt = new Date();
    const newInterest = accrue(
      loan.principalOutstanding + loan.accruedInterestSnapshot,
      loan.interestRate,
      loan.compoundingPeriod,
      loan.lastEventDate,
      paidAt,
    );
    const accruedNow = loan.accruedInterestSnapshot + newInterest;
    const totalOwed = loan.principalOutstanding + accruedNow;

    const applied = Math.min(amountInLoanCurrency, totalOwed);
    const interestPortion = Math.min(applied, accruedNow);
    const principalPortion = applied - interestPortion;

    const newAccrued = Math.max(0, accruedNow - interestPortion);
    const newPrincipal = Math.max(0, loan.principalOutstanding - principalPortion);
    const settled = newPrincipal <= 0.005 && newAccrued <= 0.005;
    const newStatus: LoanStatus = settled ? "settled" : "partially_paid";

    tx.update(loanRef, {
      principalOutstanding: newPrincipal,
      accruedInterestSnapshot: newAccrued,
      remainingAmount: newPrincipal + newAccrued,
      lastEventDate: paidAt,
      status: newStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const repaymentRef = loanRef.collection("repayments").doc();
    tx.set(repaymentRef, {
      amount: repayment.amount,
      currency: repayment.currency,
      exchangeRateUsed,
      amountInLoanCurrency,
      principalPortion,
      interestPortion,
      note: repayment.note,
      recordedBy: repayment.recordedBy,
      paidAt,
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
      const owed = convertAmount(liveLoanState(l).totalOwed, l.currency, baseCurrency, rates);
      return l.lenderId === userAId ? sum + owed : sum - owed;
    }, 0);
}
