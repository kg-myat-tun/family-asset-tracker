import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { IncomeView } from "@/components/income/IncomeView";
import { requireUser } from "@/lib/auth.server";
import { getCachedRates } from "@/lib/currency.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getServerI18n } from "@/lib/i18n/server";
import { getIncomes } from "@/lib/income.server";
import { getQueryClient } from "@/lib/query/get-query-client";
import { keys } from "@/lib/query/keys";

export default async function IncomePage() {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const queryClient = getQueryClient();
  const [rates, members, { dict }] = await Promise.all([
    getCachedRates(family.id),
    getFamilyMembers(family.id),
    getServerI18n(),
    queryClient.prefetchQuery({
      queryKey: keys.income.list(family.id),
      queryFn: () => getIncomes(family.id, user.uid),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <IncomeView
        familyId={family.id}
        baseCurrency={family.baseCurrency}
        rates={rates}
        members={members}
        dict={dict}
      />
    </HydrationBoundary>
  );
}
