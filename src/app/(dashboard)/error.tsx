"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { dict } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <span className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/15 text-red-600 dark:text-red-400 mb-4">
        <TriangleAlert className="w-7 h-7" aria-hidden="true" />
      </span>
      <h2 className="text-lg font-semibold text-foreground mb-2">{dict.ui.errorTitle}</h2>
      <p className="text-muted text-sm mb-6 max-w-sm">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-strong text-sm"
      >
        {dict.ui.tryAgain}
      </button>
    </div>
  );
}
