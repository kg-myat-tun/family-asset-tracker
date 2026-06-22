import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { LoanDetailView } from "@/components/loans/LoanDetailView";
import { requireUser } from "@/lib/auth.server";
import { getCachedRates } from "@/lib/currency.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getServerI18n } from "@/lib/i18n/server";
import { getLoan, getRepayments } from "@/lib/loans.server";
import { getQueryClient } from "@/lib/query/get-query-client";
import { keys } from "@/lib/query/keys";
import { canViewLoan } from "@/lib/visibility";

export default async function LoanDetailPage({ params }: { params: Promise<{ loanId: string }> }) {
  const { loanId } = await params;
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const [loan, repayments, members, rates, { dict }] = await Promise.all([
    getLoan(family.id, loanId),
    getRepayments(family.id, loanId),
    getFamilyMembers(family.id),
    getCachedRates(family.id),
    getServerI18n(),
  ]);

  if (!loan || !canViewLoan(loan, user.uid)) notFound();

  const self = members.find((m) => m.uid === user.uid);
  const canAct = loan.lenderId === user.uid || loan.borrowerId === user.uid;
  const canMutate = canAct || self?.role === "admin";

  // Seed the detail query from the data already loaded for the gate above.
  const queryClient = getQueryClient();
  queryClient.setQueryData(keys.loans.detail(family.id, loanId), { loan, repayments });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <LoanDetailView
        familyId={family.id}
        loanId={loanId}
        baseCurrency={family.baseCurrency}
        rates={rates}
        members={members}
        canAct={canAct}
        canMutate={canMutate}
        dict={dict}
      />
    </HydrationBoundary>
  );
}
