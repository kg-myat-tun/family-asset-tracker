import type { Metadata, Viewport } from "next";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { getServerI18n } from "@/lib/i18n/server";
import { APP_NAME, APP_URL, BRAND, SEO } from "@/lib/seo";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getServerI18n();
  const seo = SEO[locale];

  return {
    metadataBase: new URL(APP_URL),
    applicationName: APP_NAME,
    title: { default: seo.title, template: `%s · ${seo.title}` },
    description: seo.description,
    // Private, auth-gated app — keep every page out of search indexes.
    robots: { index: false, follow: false, nocache: true },
    appleWebApp: { capable: true, title: seo.title, statusBarStyle: "default" },
    formatDetection: { telephone: false, email: false, address: false },
    openGraph: {
      type: "website",
      siteName: APP_NAME,
      title: seo.title,
      description: seo.description,
      locale: seo.ogLocale,
      url: "/",
    },
    twitter: { card: "summary_large_image", title: seo.title, description: seo.description },
  };
}

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BRAND.backgroundLight },
    { media: "(prefers-color-scheme: dark)", color: BRAND.backgroundDark },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale, dict } = await getServerI18n();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Apply the saved/system theme before first paint to avoid a flash. */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: tiny inline theme bootstrap
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <I18nProvider locale={locale} dict={dict}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
