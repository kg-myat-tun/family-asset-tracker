import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Bitcoin,
  ChevronRight,
  Home,
  Landmark,
  Lock,
  Package,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { convertAmount, formatCurrency } from "@/lib/currency.server";
import type { Asset } from "@/types";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  cash: Banknote,
  bank: Landmark,
  investment: TrendingUp,
  property: Home,
  crypto: Bitcoin,
  other: Package,
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
        icon={Wallet}
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
        const CategoryIcon = CATEGORY_ICONS[asset.category] ?? Package;
        return (
          <Link key={asset.id} href={`/assets/${asset.id}`} className="block">
            <div className="card card-hover p-4 flex items-center gap-4">
              <span className="icon-chip shrink-0">
                <CategoryIcon className="w-5 h-5" aria-hidden="true" />
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground truncate">{asset.name}</p>
                  <span className="hidden sm:inline shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent-soft text-accent-strong capitalize">
                    {asset.category}
                  </span>
                  {asset.visibility === "private" && (
                    <Lock
                      className="shrink-0 w-3.5 h-3.5 text-muted/70"
                      aria-label="Private — only visible to you"
                    />
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

              <ChevronRight className="w-4 h-4 text-muted/60 shrink-0" aria-hidden="true" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
