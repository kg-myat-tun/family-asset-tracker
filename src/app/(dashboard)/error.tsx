"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <span className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 text-red-600 mb-4">
        <TriangleAlert className="w-7 h-7" aria-hidden="true" />
      </span>
      <h2 className="text-lg font-semibold text-foreground mb-2">Something went wrong</h2>
      <p className="text-muted text-sm mb-6 max-w-sm">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-strong text-sm"
      >
        Try again
      </button>
    </div>
  );
}
