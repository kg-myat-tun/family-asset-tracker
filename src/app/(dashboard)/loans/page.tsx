import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { LoansView } from "@/components/loans/LoansView";
import { requireUser } from "@/lib/auth.server";
import { getCachedRates } from "@/lib/currency.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getServerI18n } from "@/lib/i18n/server";
import { getLoans } from "@/lib/loans.server";
import { getQueryClient } from "@/lib/query/get-query-client";
import { keys } from "@/lib/query/keys";
import { canViewLoan } from "@/lib/visibility";

const TABS = ["all", "lent", "owed"] as const;
type Tab = (typeof TABS)[number];

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: Tab }>;
}) {
  const { tab: tabParam } = await searchParams;
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : "all";

  const queryClient = getQueryClient();
  const [members, rates, { dict }] = await Promise.all([
    getFamilyMembers(family.id),
    getCachedRates(family.id),
    getServerI18n(),
    // Match the /api/loans handler exactly: visibility-filtered here too.
    queryClient.prefetchQuery({
      queryKey: keys.loans.list(family.id),
      queryFn: async () => {
        const loans = await getLoans(family.id);
        return loans.filter((l) => canViewLoan(l, user.uid));
      },
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <LoansView
        familyId={family.id}
        baseCurrency={family.baseCurrency}
        rates={rates}
        members={members}
        currentUid={user.uid}
        dict={dict}
        tab={tab}
      />
    </HydrationBoundary>
  );
}
