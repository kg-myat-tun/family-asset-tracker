"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocaleAction } from "@/actions/locale.actions";
import { useI18n } from "@/components/i18n/I18nProvider";
import { type Locale, localeNames } from "@/lib/i18n/config";

// Two languages, so the control is a simple toggle: it shows the current
// language and switches to the other on click.
export function LanguageToggle() {
  const { locale } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next: Locale = locale === "en" ? "my" : "en";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setLocaleAction(next);
          router.refresh();
        })
      }
      aria-label={`Switch to ${localeNames[next]}`}
      title={`Switch to ${localeNames[next]}`}
      className="flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-full border border-line text-sm text-muted hover:text-foreground hover:bg-accent-soft transition-colors disabled:opacity-50"
    >
      <Languages className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span className="hidden sm:inline font-medium">{localeNames[locale]}</span>
    </button>
  );
}
