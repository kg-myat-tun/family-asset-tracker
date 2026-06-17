"use client";

import { deleteAssetAction } from "@/actions/asset.actions";
import { useI18n } from "@/components/i18n/I18nProvider";

export function DeleteAssetButton({ assetId, label }: { assetId: string; label: string }) {
  const { dict } = useI18n();
  const action = deleteAssetAction.bind(null, assetId);

  return (
    <form action={action}>
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm(`${dict.assets.deleteConfirm} ${label}?`)) e.preventDefault();
        }}
        className="text-sm text-red-500 hover:text-red-700"
      >
        {dict.assets.delete}
      </button>
    </form>
  );
}
