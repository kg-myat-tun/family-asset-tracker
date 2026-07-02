import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { AssetDetailView } from "@/components/assets/AssetDetailView";
import { getAsset } from "@/lib/assets.server";
import { requireUser } from "@/lib/auth.server";
import { getCachedRates } from "@/lib/currency.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { getServerI18n } from "@/lib/i18n/server";
import { getQueryClient } from "@/lib/query/get-query-client";
import { keys } from "@/lib/query/keys";
import { canViewAsset } from "@/lib/visibility";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const asset = await getAsset(family.id, assetId);
  if (!asset || !canViewAsset(asset, user.uid)) notFound();

  const [rates, members, { dict }] = await Promise.all([
    getCachedRates(family.id),
    getFamilyMembers(family.id),
    getServerI18n(),
  ]);

  // Seed the detail query with the asset we already loaded for the gate above —
  // no extra read. The client view refetches from /api/assets/[id] thereafter.
  const queryClient = getQueryClient();
  queryClient.setQueryData(keys.assets.detail(family.id, assetId), asset);

  const owner = members.find((m) => m.uid === asset.ownerId);
  const canMutate = asset.ownerId === user.uid;

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AssetDetailView
        familyId={family.id}
        assetId={assetId}
        baseCurrency={family.baseCurrency}
        rates={rates}
        ownerName={owner?.displayName ?? dict.assets.unknownOwner}
        canMutate={canMutate}
        dict={dict}
      />
    </HydrationBoundary>
  );
}
