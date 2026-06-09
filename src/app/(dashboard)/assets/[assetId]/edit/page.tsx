import { notFound, redirect } from "next/navigation";
import { updateAssetAction } from "@/actions/asset.actions";
import { AssetForm } from "@/components/assets/AssetForm";
import { getAsset } from "@/lib/assets.server";
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser, getFamilyMembers } from "@/lib/family.server";
import { canViewAsset } from "@/lib/visibility";

export default async function EditAssetPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const asset = await getAsset(family.id, assetId);
  if (!asset || !canViewAsset(asset, user.uid)) notFound();

  const members = await getFamilyMembers(family.id);
  const self = members.find((m) => m.uid === user.uid);
  const canMutate = asset.ownerId === user.uid || self?.role === "admin";
  if (!canMutate) redirect(`/assets/${asset.id}`);

  const boundAction = updateAssetAction.bind(null, asset.id);

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-foreground mb-6">Edit asset</h1>
      <AssetForm action={boundAction} defaultValues={asset} submitLabel="Save changes" />
    </div>
  );
}
