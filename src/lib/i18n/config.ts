export const locales = ["en", "my"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

// Cookie that stores the chosen language (per device).
export const LOCALE_COOKIE = "locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

// Self-name of each language, shown in the switcher.
export const localeNames: Record<Locale, string> = {
  en: "English",
  my: "မြန်မာ",
};
