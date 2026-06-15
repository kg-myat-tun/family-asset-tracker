import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";

export default function AssetNotFound() {
  return (
    <div className="text-center py-24">
      <span className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-foreground/6 text-muted mb-4">
        <SearchX className="w-7 h-7" aria-hidden="true" />
      </span>
      <p className="text-lg font-medium text-foreground">Asset not found</p>
      <p className="text-muted text-sm">It may have been deleted.</p>
      <Link
        href="/assets"
        className="inline-flex items-center gap-1.5 mt-6 text-sm text-accent hover:underline"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to assets
      </Link>
    </div>
  );
}
