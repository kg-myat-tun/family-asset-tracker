import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { requireUser } from "@/lib/auth.server";
import { getCachedRates } from "@/lib/currency.server";
import { getDashboardData } from "@/lib/dashboard.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getServerI18n } from "@/lib/i18n/server";
import { getQueryClient } from "@/lib/query/get-query-client";
import { keys } from "@/lib/query/keys";

export default async function DashboardPage() {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const members = await getFamilyMembers(family.id);

  const queryClient = getQueryClient();
  const [rates, { dict }] = await Promise.all([
    getCachedRates(family.id),
    getServerI18n(),
    queryClient.prefetchQuery({
      queryKey: keys.dashboard(family.id),
      queryFn: () => getDashboardData(family.id, members, family.baseCurrency, user.uid),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardView
        familyId={family.id}
        baseCurrency={family.baseCurrency}
        rates={rates}
        members={members}
        dict={dict}
      />
    </HydrationBoundary>
  );
}
