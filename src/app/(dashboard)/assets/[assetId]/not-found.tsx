import Link from "next/link";

export default function AssetNotFound() {
  return (
    <div className="text-center py-24">
      <p className="text-5xl mb-4">🔍</p>
      <p className="text-lg font-medium text-foreground">Asset not found</p>
      <p className="text-muted text-sm">It may have been deleted.</p>
      <Link href="/assets" className="inline-block mt-6 text-sm text-accent hover:underline">
        ← Back to assets
      </Link>
    </div>
  );
}
