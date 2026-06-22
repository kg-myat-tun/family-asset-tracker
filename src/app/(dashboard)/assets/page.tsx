import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { AssetsView } from "@/components/assets/AssetsView";
import { getAssets } from "@/lib/assets.server";
import { requireUser } from "@/lib/auth.server";
import { getCachedRates } from "@/lib/currency.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getServerI18n } from "@/lib/i18n/server";
import { getQueryClient } from "@/lib/query/get-query-client";
import { keys } from "@/lib/query/keys";

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string; category?: string }>;
}) {
  const { owner, category } = await searchParams;
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const queryClient = getQueryClient();
  const [rates, members, { dict }] = await Promise.all([
    getCachedRates(family.id),
    getFamilyMembers(family.id),
    getServerI18n(),
    // Prefetch the full viewable list into the per-request cache; the client
    // view hydrates from this (no loading spinner on first paint) then owns
    // refetching. Search/owner/category are filtered client-side over this list.
    queryClient.prefetchQuery({
      queryKey: keys.assets.list(family.id),
      queryFn: () => getAssets(family.id, user.uid),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AssetsView
        familyId={family.id}
        baseCurrency={family.baseCurrency}
        rates={rates}
        members={members}
        dict={dict}
        owner={owner}
        category={category}
      />
    </HydrationBoundary>
  );
}
