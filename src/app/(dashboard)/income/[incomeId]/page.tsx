import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { IncomeDetailView } from "@/components/income/IncomeDetailView";
import { requireUser } from "@/lib/auth.server";
import { getCachedRates } from "@/lib/currency.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getServerI18n } from "@/lib/i18n/server";
import { getIncome } from "@/lib/income.server";
import { getQueryClient } from "@/lib/query/get-query-client";
import { keys } from "@/lib/query/keys";
import { canViewIncome } from "@/lib/visibility";

export default async function IncomeDetailPage({
  params,
}: {
  params: Promise<{ incomeId: string }>;
}) {
  const { incomeId } = await params;
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const income = await getIncome(family.id, incomeId);
  if (!income || !canViewIncome(income, user.uid)) notFound();

  const [rates, members, { dict }] = await Promise.all([
    getCachedRates(family.id),
    getFamilyMembers(family.id),
    getServerI18n(),
  ]);

  const queryClient = getQueryClient();
  queryClient.setQueryData(keys.income.detail(family.id, incomeId), income);

  const owner = members.find((m) => m.uid === income.ownerId);
  const self = members.find((m) => m.uid === user.uid);
  const canMutate = income.ownerId === user.uid || self?.role === "admin";

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <IncomeDetailView
        familyId={family.id}
        incomeId={incomeId}
        baseCurrency={family.baseCurrency}
        rates={rates}
        ownerName={owner?.displayName ?? dict.income.unknownOwner}
        canMutate={canMutate}
        dict={dict}
      />
    </HydrationBoundary>
  );
}
