"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { DeleteAssetButton } from "@/components/assets/DeleteAssetButton";
import { VisibilityBadge } from "@/components/ui/VisibilityBadge";
import { isDynamicAsset } from "@/lib/asset-price";
import { convertAmount, formatCurrency } from "@/lib/currency";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fetchJson } from "@/lib/query/fetch-json";
import { keys } from "@/lib/query/keys";
import type { Asset } from "@/types";

interface Props {
  familyId: string;
  assetId: string;
  baseCurrency: string;
  rates: Record<string, number>;
  ownerName: string;
  canMutate: boolean;
  dict: Dictionary;
}

export function AssetDetailView({
  familyId,
  assetId,
  baseCurrency,
  rates,
  ownerName,
  canMutate,
  dict,
}: Props) {
  const { data: asset } = useQuery({
    queryKey: keys.assets.detail(familyId, assetId),
    queryFn: () => fetchJson<Asset>(`/api/assets/${assetId}`),
  });

  // Hydrated from the server prefetch, so this is effectively always defined on
  // first paint. Guard for the brief window after an optimistic delete.
  if (!asset) return null;

  const converted = convertAmount(asset.amount, asset.currency, baseCurrency, rates);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-foreground">{asset.name}</h1>
          <VisibilityBadge visibility={asset.visibility} />
        </div>
        {canMutate && (
          <div className="flex items-center gap-3">
            <Link href={`/assets/${asset.id}/edit`} className="text-sm text-accent hover:underline">
              {dict.assets.edit}
            </Link>
            <DeleteAssetButton assetId={asset.id} label={asset.name} />
          </div>
        )}
      </div>

      <dl className="bg-card rounded-xl border border-line divide-y divide-line">
        <Row label={dict.assets.category}>
          <span>{dict.assets.categories[asset.category]}</span>
        </Row>
        {isDynamicAsset(asset.category) && asset.symbol && asset.quantity != null && (
          <Row label={dict.assets.holdings}>
            <span>
              {asset.quantity} {asset.symbol}
              {asset.quantity > 0 && (
                <span className="text-muted">
                  {" "}
                  @ {formatCurrency(asset.amount / asset.quantity, asset.currency)}
                </span>
              )}
            </span>
          </Row>
        )}
        <Row label={dict.assets.amount}>
          <div>
            <p className="font-semibold">{formatCurrency(asset.amount, asset.currency)}</p>
            {asset.currency !== baseCurrency && (
              <p className="text-xs text-muted">≈ {formatCurrency(converted, baseCurrency)}</p>
            )}
          </div>
        </Row>
        <Row label={dict.assets.owner}>{ownerName}</Row>
        {asset.description && <Row label={dict.assets.description}>{asset.description}</Row>}
      </dl>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 px-4 py-3 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-foreground text-right">{children}</dd>
    </div>
  );
}
