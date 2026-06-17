import type { Locale } from "@/lib/i18n/config";

/** Locale-aware SEO copy. Kept here (not in dictionaries) so the metadata layer
 * stays decoupled from the in-app UI strings. */
export const SEO = {
  en: {
    title: "Family Asset Tracker",
    description: "Privately track your family's assets and loans across multiple currencies.",
    ogLocale: "en_US",
  },
  my: {
    title: "မိသားစု ပိုင်ဆိုင်မှု မှတ်တမ်း",
    description: "သင့်မိသားစု၏ ပိုင်ဆိုင်မှုများနှင့် ချေးငွေများကို ငွေကြေးအမျိုးမျိုးဖြင့် သီးသန့်စီမံခန့်ခွဲပါ။",
    ogLocale: "my_MM",
  },
} as const satisfies Record<Locale, { title: string; description: string; ogLocale: string }>;

/** Canonical English brand name used for siteName / applicationName. */
export const APP_NAME = "Family Asset Tracker";

/** Absolute base URL for metadata, Open Graph and manifest. */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Brand colours shared by the generated icons, OG image and theme-color. */
export const BRAND = {
  accent: "#2563eb",
  accentStrong: "#1d4ed8",
  backgroundLight: "#f8fafc",
  backgroundDark: "#11141b",
} as const;

/** Lucide "wallet" outline — shared by the favicon, apple icon and OG image. */
export const WALLET_PATH =
  "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V6";
