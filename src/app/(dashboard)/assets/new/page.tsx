import { createAssetAction } from "@/actions/asset.actions";
import { AssetForm } from "@/components/assets/AssetForm";
import { getServerI18n } from "@/lib/i18n/server";

export default async function NewAssetPage() {
  const { dict } = await getServerI18n();
  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold text-foreground mb-6">{dict.assets.addTitle}</h1>
      <AssetForm action={createAssetAction} submitLabel={dict.assets.createAsset} />
    </div>
  );
}
