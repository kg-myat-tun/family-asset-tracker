import { createAssetAction } from "@/actions/asset.actions";
import { AssetForm } from "@/components/assets/AssetForm";

export default function NewAssetPage() {
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Add asset</h1>
      <AssetForm action={createAssetAction} submitLabel="Create asset" />
    </div>
  );
}
