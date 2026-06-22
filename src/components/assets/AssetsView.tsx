"use client";

import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AssetFilters } from "@/components/assets/AssetFilters";
import { AssetList } from "@/components/assets/AssetList";
import { convertAmount, formatCurrency } from "@/lib/currency";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { plural } from "@/lib/i18n/dictionaries";
import { fetchJson } from "@/lib/query/fetch-json";
import { keys } from "@/lib/query/keys";
import type { Asset, FamilyMember } from "@/types";

interface Props {
  familyId: string;
  baseCurrency: string;
  rates: Record<string, number>;
  members: FamilyMember[];
  dict: Dictionary;
  owner?: string;
  category?: string;
}

export function AssetsView({
  familyId,
  baseCurrency,
  rates,
  members,
  dict,
  owner,
  category,
}: Props) {
  const { data: assets = [] } = useQuery({
    queryKey: keys.assets.list(familyId),
    queryFn: () => fetchJson<Asset[]>("/api/assets"),
  });

  // Search + owner + category are all client-side view state over the full
  // viewable list (visibility is already enforced server-side in getAssets).
  // `owner`/`category` props seed the initial state so deep links still work.
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState(owner ?? "");
  const [categoryFilter, setCategoryFilter] = useState(category ?? "");

  const memberMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.uid, m.displayName])),
    [members],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      if (ownerFilter && a.ownerId !== ownerFilter) return false;
      if (categoryFilter && a.category !== categoryFilter) return false;
      if (q && !a.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [assets, search, ownerFilter, categoryFilter]);

  const totalInBase = filtered.reduce(
    (sum, a) => sum + convertAmount(a.amount, a.currency, baseCurrency, rates),
    0,
  );
  const count = filtered.length;
  const isFiltering = search.trim() !== "" || ownerFilter !== "" || categoryFilter !== "";

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

      <AssetFilters
        dict={dict}
        members={members}
        search={search}
        owner={ownerFilter}
        category={categoryFilter}
        onSearchChange={setSearch}
        onOwnerChange={setOwnerFilter}
        onCategoryChange={setCategoryFilter}
      />

      <AssetList
        assets={filtered}
        memberMap={memberMap}
        baseCurrency={baseCurrency}
        rates={rates}
        dict={dict}
        filtered={isFiltering}
      />
    </div>
  );
}
