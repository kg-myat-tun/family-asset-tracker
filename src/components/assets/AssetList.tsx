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

  const rows = assets.map((asset) => ({
    asset,
    base: convertAmount(asset.amount, asset.currency, baseCurrency, rates),
  }));
  const total = rows.reduce((sum, r) => sum + r.base, 0) || 1;

  return (
    <div className="space-y-2.5">
      {rows.map(({ asset, base }) => {
        const share = Math.round((base / total) * 100);
        return (
          <Link key={asset.id} href={`/assets/${asset.id}`} className="block">
            <div className="card card-hover p-4 flex items-center gap-4">
              <span className="icon-chip text-xl shrink-0">{CATEGORY_ICONS[asset.category]}</span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground truncate">{asset.name}</p>
                  <span className="hidden sm:inline shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent-soft text-accent-strong capitalize">
                    {asset.category}
                  </span>
                  {asset.visibility === "private" && (
                    <span
                      className="shrink-0 text-xs text-muted/70"
                      title="Private — only visible to you"
                    >
                      🔒
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2 max-w-[16rem]">
                  <div className="h-1.5 flex-1 rounded-full bg-foreground/6 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.max(share, 2)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted tabular-nums w-9 text-right">{share}%</span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="font-semibold text-foreground tabular-nums">
                  {formatCurrency(asset.amount, asset.currency)}
                </p>
                {asset.currency !== baseCurrency && (
                  <p className="text-xs text-muted tabular-nums">
                    ≈ {formatCurrency(base, baseCurrency)}
                  </p>
                )}
              </div>

              <svg
                className="w-4 h-4 text-muted/60 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <title>Open</title>
                <path d="m9 18 6-6-6-6" />
              </svg>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
