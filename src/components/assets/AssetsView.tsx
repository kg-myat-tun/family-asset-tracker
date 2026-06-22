"use client";

import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import Link from "next/link";
import { AssetList } from "@/components/assets/AssetList";
import { convertAmount, formatCurrency } from "@/lib/currency";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { plural } from "@/lib/i18n/dictionaries";
import { fetchJson } from "@/lib/query/fetch-json";
import { keys } from "@/lib/query/keys";
import type { Asset } from "@/types";

interface Props {
  familyId: string;
  baseCurrency: string;
  rates: Record<string, number>;
  dict: Dictionary;
  owner?: string;
  category?: string;
}

export function AssetsView({ familyId, baseCurrency, rates, dict, owner, category }: Props) {
  const { data: assets = [] } = useQuery({
    queryKey: keys.assets.list(familyId, owner),
    queryFn: () =>
      fetchJson<Asset[]>(`/api/assets${owner ? `?owner=${encodeURIComponent(owner)}` : ""}`),
  });

  // Category is a pure view filter over the fetched list (not a fetch key).
  const filtered = category ? assets.filter((a) => a.category === category) : assets;
  const totalInBase = filtered.reduce(
    (sum, a) => sum + convertAmount(a.amount, a.currency, baseCurrency, rates),
    0,
  );
  const count = filtered.length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{dict.assets.title}</h1>
          <p className="text-sm text-muted mt-1">
            {count} {plural(count, dict.assets.unitOne, dict.assets.unitOther)} · {baseCurrency}
          </p>
        </div>
        <Link href="/assets/new" className="btn-primary shrink-0">
          {dict.assets.addAsset}
        </Link>
      </div>

      <div className="card p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{dict.assets.totalValue}</p>
          <p className="text-3xl font-bold text-foreground mt-1 tracking-tight tabular-nums">
            {formatCurrency(totalInBase, baseCurrency)}
          </p>
        </div>
        <span className="icon-chip">
          <Wallet className="w-5 h-5" aria-hidden="true" />
        </span>
      </div>

      <AssetList assets={filtered} baseCurrency={baseCurrency} rates={rates} dict={dict} />
    </div>
  );
}
