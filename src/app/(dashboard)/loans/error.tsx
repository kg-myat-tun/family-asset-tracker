"use client";

import { useEffect } from "react";

export default function LoansError({
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
      <p className="text-gray-500 mb-4">Failed to load loans: {error.message}</p>
      <button type="button" onClick={reset} className="text-blue-600 hover:underline">
        Try again
      </button>
    </div>
  );
}
