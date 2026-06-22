"use client";

import { Search } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { AssetCategory, FamilyMember } from "@/types";

const CATEGORIES = ["cash", "bank", "investment", "property", "crypto", "stock", "other"] as const;

const FIELD =
  "py-2 border border-line rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-accent-soft";

interface Props {
  dict: Dictionary;
  members: FamilyMember[];
  search: string;
  owner: string;
  category: string;
  onSearchChange: (value: string) => void;
  onOwnerChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
}

export function AssetFilters({
  dict,
  members,
  search,
  owner,
  category,
  onSearchChange,
  onOwnerChange,
  onCategoryChange,
}: Props) {
  return (
    <div className="flex flex-col sm:flex-row gap-2.5">
      <div className="relative flex-1">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/70 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={dict.assets.searchPlaceholder}
          aria-label={dict.assets.searchPlaceholder}
          className={`${FIELD} w-full pl-9 pr-4`}
        />
      </div>

      <select
        value={owner}
        onChange={(e) => onOwnerChange(e.target.value)}
        aria-label={dict.assets.owner}
        className={`${FIELD} px-3 sm:w-44`}
      >
        <option value="">{dict.assets.allOwners}</option>
        {members.map((m) => (
          <option key={m.uid} value={m.uid}>
            {m.displayName}
          </option>
        ))}
      </select>

      <select
        value={category}
        onChange={(e) => onCategoryChange(e.target.value)}
        aria-label={dict.assets.category}
        className={`${FIELD} px-3 sm:w-44`}
      >
        <option value="">{dict.assets.allCategories}</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {dict.assets.categories[c as AssetCategory]}
          </option>
        ))}
      </select>
    </div>
  );
}
