import { notFound } from "next/navigation";
import { LoanDetail } from "@/components/loans/LoanDetail";
import { requireUser } from "@/lib/auth.server";
import { getCachedRates } from "@/lib/currency.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getLoan, getRepayments } from "@/lib/loans.server";
import { canViewLoan } from "@/lib/visibility";

export default async function LoanDetailPage({ params }: { params: Promise<{ loanId: string }> }) {
  const { loanId } = await params;
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const [loan, repayments, members, rates] = await Promise.all([
    getLoan(family.id, loanId),
    getRepayments(family.id, loanId),
    getFamilyMembers(family.id),
    getCachedRates(family.id),
  ]);

  if (!loan || !canViewLoan(loan, user.uid)) notFound();

  const memberMap = Object.fromEntries(members.map((m) => [m.uid, m]));
  const canAct = loan.lenderId === user.uid || loan.borrowerId === user.uid;

  return (
    <LoanDetail
      loan={loan}
      repayments={repayments}
      memberMap={memberMap}
      baseCurrency={family.baseCurrency}
      rates={rates}
      canAct={canAct}
    />
  );
}
