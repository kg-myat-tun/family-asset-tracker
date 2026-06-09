"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const STATIC_LABELS: Record<string, string> = {
  dashboard: "Overview",
  assets: "Assets",
  loans: "Loans",
  members: "Members",
  profile: "Profile",
  new: "New",
  edit: "Edit",
};

const SINGULAR: Record<string, string> = {
  assets: "Asset",
  loans: "Loan",
};

interface Crumb {
  label: string;
  href: string;
}

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [];

  const crumbs: Crumb[] = [];
  segments.forEach((seg, i) => {
    const href = `/${segments.slice(0, i + 1).join("/")}`;
    const known = STATIC_LABELS[seg];
    let label: string;
    if (known) {
      label = known;
    } else {
      // Dynamic id segment (e.g. an assetId). Label it from its parent noun.
      const noun = SINGULAR[segments[i - 1]] ?? "Item";
      const isLeaf = i === segments.length - 1;
      label = isLeaf ? `${noun} details` : noun;
    }
    crumbs.push({ label, href });
  });

  // Always anchor the trail at the dashboard root.
  if (segments[0] !== "dashboard") {
    crumbs.unshift({ label: "Overview", href: "/dashboard" });
  }
  return crumbs;
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

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
