import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { convertAmount, formatCurrency } from "@/lib/currency.server";
import type { Asset } from "@/types";

const CATEGORY_ICONS: Record<string, string> = {
  cash: "💵",
  bank: "🏦",
  investment: "📈",
  property: "🏠",
  crypto: "₿",
  other: "📦",
};

interface Props {
  assets: Asset[];
  baseCurrency: string;
  rates: Record<string, number>;
}

export function AssetList({ assets, baseCurrency, rates }: Props) {
  if (assets.length === 0) {
    return (
      <EmptyState
        icon="💰"
        title="No assets yet"
        description="Start tracking your family's wealth by adding your first asset."
        action={{ label: "+ Add asset", href: "/assets/new" }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {assets.map((asset) => {
        const converted = convertAmount(asset.amount, asset.currency, baseCurrency, rates);
        return (
          <Link key={asset.id} href={`/assets/${asset.id}`}>
            <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition-colors flex items-center gap-4">
              <span className="text-2xl">{CATEGORY_ICONS[asset.category]}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{asset.name}</p>
                <p className="text-sm text-gray-500 capitalize">{asset.category}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-semibold text-gray-900">
                  {formatCurrency(asset.amount, asset.currency)}
                </p>
                {asset.currency !== baseCurrency && (
                  <p className="text-xs text-gray-400">
                    ≈ {formatCurrency(converted, baseCurrency)}
                  </p>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
