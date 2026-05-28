"use client";

import { deleteAssetAction } from "@/actions/asset.actions";

export function DeleteAssetButton({ assetId, label }: { assetId: string; label: string }) {
  const action = deleteAssetAction.bind(null, assetId);

  return (
    <form action={action}>
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm(`Delete ${label}?`)) e.preventDefault();
        }}
        className="text-sm text-red-500 hover:text-red-700"
      >
        Delete
      </button>
    </form>
  );
}
