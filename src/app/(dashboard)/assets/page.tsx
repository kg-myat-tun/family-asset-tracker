import Link from "next/link";
import { AssetList } from "@/components/assets/AssetList";
import { getAssets } from "@/lib/assets.server";
import { requireUser } from "@/lib/auth.server";
import { convertAmount, formatCurrency, getCachedRates } from "@/lib/currency.server";
import { getFamilyForUser } from "@/lib/family.server";

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string; category?: string }>;
}) {
  const { owner, category } = await searchParams;
  const user = await requireUser();
  const family = await getFamilyForUser(user.uid);
  if (!family) return null;

  const [assets, rates] = await Promise.all([
    getAssets(family.id, user.uid, owner),
    getCachedRates(family.id),
  ]);

  const filtered = category ? assets.filter((a) => a.category === category) : assets;

  const totalInBase = filtered.reduce(
    (sum, a) => sum + convertAmount(a.amount, a.currency, family.baseCurrency, rates),
    0,
  );

  const count = filtered.length;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Assets</h1>
          <p className="text-sm text-muted mt-1">
            {count} {count === 1 ? "asset" : "assets"} · {family.baseCurrency}
          </p>
        </div>
        <Link href="/assets/new" className="btn-primary shrink-0">
          + Add asset
        </Link>
      </div>

      <div className="card p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Total value</p>
          <p className="text-3xl font-bold text-foreground mt-1 tracking-tight tabular-nums">
            {formatCurrency(totalInBase, family.baseCurrency)}
          </p>
        </div>
        <span className="icon-chip text-xl">💰</span>
      </div>

      <AssetList assets={filtered} baseCurrency={family.baseCurrency} rates={rates} />
    </div>
  );
}
