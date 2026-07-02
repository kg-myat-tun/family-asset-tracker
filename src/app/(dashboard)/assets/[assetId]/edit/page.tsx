import { notFound, redirect } from "next/navigation";
import { updateAssetAction } from "@/actions/asset.actions";
import { AssetForm } from "@/components/assets/AssetForm";
import { getAsset } from "@/lib/assets.server";
import { requireUser } from "@/lib/auth.server";
import { getFamilyForUser } from "@/lib/family.server";
import { getServerI18n } from "@/lib/i18n/server";
import { canViewAsset } from "@/lib/visibility";

export default async function EditAssetPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const asset = await getAsset(family.id, assetId);
  if (!asset || !canViewAsset(asset, user.uid)) notFound();

  if (asset.ownerId !== user.uid) redirect(`/assets/${asset.id}`);

  const boundAction = updateAssetAction.bind(null, asset.id);
  const { dict } = await getServerI18n();

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold text-foreground mb-6">{dict.assets.editTitle}</h1>
      <AssetForm action={boundAction} defaultValues={asset} submitLabel={dict.common.saveChanges} />
    </div>
  );
}
