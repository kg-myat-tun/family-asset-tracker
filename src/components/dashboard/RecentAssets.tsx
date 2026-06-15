import { ArrowRight, Wallet } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency.server";
import type { Asset } from "@/types";

export function RecentAssets({ assets }: { assets: Asset[] }) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="icon-chip">
            <Wallet className="w-5 h-5" aria-hidden="true" />
          </span>
          <h2 className="font-semibold text-foreground">Recent assets</h2>
        </div>
        <Link
          href="/assets"
          className="text-sm font-medium text-accent hover:text-accent-strong inline-flex items-center gap-1"
        >
          View all <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>
      {assets.length === 0 ? (
        <p className="text-muted text-sm">No assets yet.</p>
      ) : (
        <div className="space-y-1">
          {assets.map((a) => (
            <Link
              key={a.id}
              href={`/assets/${a.id}`}
              className="flex justify-between items-center text-sm -mx-2 px-2 py-2 rounded-lg hover:bg-accent-soft/50 transition-colors"
            >
              <span className="text-foreground/80 truncate">{a.name}</span>
              <span className="font-semibold text-foreground ml-4 shrink-0">
                {formatCurrency(a.amount, a.currency)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
