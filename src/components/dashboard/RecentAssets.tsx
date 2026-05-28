import Link from "next/link";
import { formatCurrency } from "@/lib/currency.server";
import type { Asset } from "@/types";

export function RecentAssets({ assets }: { assets: Asset[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Recent assets</h2>
        <Link href="/assets" className="text-sm text-blue-600 hover:underline">
          View all
        </Link>
      </div>
      {assets.length === 0 ? (
        <p className="text-gray-400 text-sm">No assets yet.</p>
      ) : (
        <div className="space-y-2">
          {assets.map((a) => (
            <Link
              key={a.id}
              href={`/assets/${a.id}`}
              className="flex justify-between text-sm hover:text-blue-600"
            >
              <span className="text-gray-700 truncate">{a.name}</span>
              <span className="font-medium ml-4 flex-shrink-0">
                {formatCurrency(a.amount, a.currency)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
