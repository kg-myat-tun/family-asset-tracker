"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface Crumb {
  label: string;
  href: string;
}

function buildCrumbs(pathname: string, dict: Dictionary): Crumb[] {
  const staticLabels: Record<string, string> = {
    dashboard: dict.nav.overview,
    assets: dict.nav.assets,
    loans: dict.nav.loans,
    members: dict.nav.members,
    profile: dict.nav.profile,
    new: dict.ui.crumbNew,
    edit: dict.ui.crumbEdit,
  };
  const singular: Record<string, string> = {
    assets: dict.ui.crumbAsset,
    loans: dict.ui.crumbLoan,
  };
  const detailLabels: Record<string, string> = {
    assets: dict.ui.crumbAssetDetails,
    loans: dict.ui.crumbLoanDetails,
  };

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [];

  const crumbs: Crumb[] = [];
  segments.forEach((seg, i) => {
    const href = `/${segments.slice(0, i + 1).join("/")}`;
    const known = staticLabels[seg];
    let label: string;
    if (known) {
      label = known;
    } else {
      // Dynamic id segment (e.g. an assetId). Label it from its parent noun.
      const parent = segments[i - 1];
      const isLeaf = i === segments.length - 1;
      label = isLeaf
        ? (detailLabels[parent] ?? dict.ui.crumbItem)
        : (singular[parent] ?? dict.ui.crumbItem);
    }
    crumbs.push({ label, href });
  });

  // Always anchor the trail at the dashboard root.
  if (segments[0] !== "dashboard") {
    crumbs.unshift({ label: dict.nav.overview, href: "/dashboard" });
  }
  return crumbs;
}

export function Breadcrumbs() {
  const { dict } = useI18n();
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname, dict);

  // A single crumb (the root overview) needs no trail.
  if (crumbs.length < 2) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-5">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={crumb.href} className="flex items-center gap-1.5">
              {i > 0 && (
                <span className="text-muted/50" aria-hidden="true">
                  /
                </span>
              )}
              {isLast ? (
                <span className="font-medium text-foreground" aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className="hover:text-foreground transition-colors">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
