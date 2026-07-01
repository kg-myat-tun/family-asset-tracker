"use client";

import { useEffect } from "react";

export default function IncomeError({
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
    <div className="text-center py-16">
      <p className="text-muted mb-4">Failed to load income: {error.message}</p>
      <button type="button" onClick={reset} className="text-accent hover:underline">
        Try again
      </button>
    </div>
  );
}
