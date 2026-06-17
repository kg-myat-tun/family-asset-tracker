import { notFound, redirect } from "next/navigation";
import { updateLoanAction } from "@/actions/loan.actions";
import { LoanEditForm } from "@/components/loans/LoanEditForm";
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getLoan, getRepayments } from "@/lib/loans.server";
import { canViewLoan } from "@/lib/visibility";

export default async function EditLoanPage({ params }: { params: Promise<{ loanId: string }> }) {
  const { loanId } = await params;
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const [loan, repayments, members] = await Promise.all([
    getLoan(family.id, loanId),
    getRepayments(family.id, loanId),
    getFamilyMembers(family.id),
  ]);

  if (!loan || !canViewLoan(loan, user.uid)) notFound();

  const self = members.find((m) => m.uid === user.uid);
  const isParticipant = loan.lenderId === user.uid || loan.borrowerId === user.uid;
  const canMutate = isParticipant || self?.role === "admin";
  if (!canMutate) redirect(`/loans/${loan.id}`);

  const memberMap = Object.fromEntries(members.map((m) => [m.uid, m]));
  const boundAction = updateLoanAction.bind(null, loan.id);

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold text-foreground mb-6">Edit loan</h1>
      <LoanEditForm
        action={boundAction}
        loan={loan}
        memberMap={memberMap}
        editableAmount={repayments.length === 0}
      />
    </div>
  );
}
