import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { TransactionsView } from "@/components/transactions/TransactionsView";
import { requireUser } from "@/lib/auth.server";
import { getCachedRates } from "@/lib/currency.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getServerI18n } from "@/lib/i18n/server";
import { getMonthlySummaries } from "@/lib/monthly-summary.server";
import { getQueryClient } from "@/lib/query/get-query-client";
import { keys } from "@/lib/query/keys";
import { getTransactions } from "@/lib/transactions.server";

export default async function TransactionsPage() {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const queryClient = getQueryClient();
  const [rates, members, { dict }] = await Promise.all([
    getCachedRates(family.id),
    getFamilyMembers(family.id),
    getServerI18n(),
    queryClient.prefetchQuery({
      queryKey: keys.transactions.list(family.id),
      queryFn: () => getTransactions(family.id, user.uid),
    }),
    queryClient.prefetchQuery({
      queryKey: keys.monthlySummaries.list(family.id),
      queryFn: () => getMonthlySummaries(family.id),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TransactionsView
        familyId={family.id}
        baseCurrency={family.baseCurrency}
        rates={rates}
        members={members}
        dict={dict}
      />
    </HydrationBoundary>
  );
}
