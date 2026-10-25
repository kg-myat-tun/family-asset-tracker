import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { RecurringRulesView } from "@/components/transactions/RecurringRulesView";
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getServerI18n } from "@/lib/i18n/server";
import { getQueryClient } from "@/lib/query/get-query-client";
import { keys } from "@/lib/query/keys";
import { getRecurringRules } from "@/lib/recurring.server";

export default async function RecurringRulesPage() {
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const queryClient = getQueryClient();
  const [members, { dict }] = await Promise.all([
    getFamilyMembers(family.id),
    getServerI18n(),
    queryClient.prefetchQuery({
      queryKey: keys.recurringRules.list(family.id),
      queryFn: () => getRecurringRules(family.id, user.uid),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RecurringRulesView familyId={family.id} members={members} dict={dict} />
    </HydrationBoundary>
  );
}
