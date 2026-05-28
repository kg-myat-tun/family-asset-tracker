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
    getAssets(family.id, owner),
    getCachedRates(family.id),
  ]);

  const filtered = category ? assets.filter((a) => a.category === category) : assets;

  const totalInBase = filtered.reduce(
    (sum, a) => sum + convertAmount(a.amount, a.currency, family.baseCurrency, rates),
    0,
  );

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Assets</h1>
          <p className="text-sm text-gray-500 mt-1">
            Total: {formatCurrency(totalInBase, family.baseCurrency)}
          </p>
        </div>
        <Link
          href="/assets/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          + Add asset
        </Link>
      </div>
      <AssetList assets={filtered} baseCurrency={family.baseCurrency} rates={rates} />
    </div>
  );
}
