import type { MetadataRoute } from "next";
import { APP_NAME, BRAND, SEO } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: "Assets",
    description: SEO.en.description,
    start_url: "/dashboard",
    display: "standalone",
    background_color: BRAND.backgroundLight,
    theme_color: BRAND.accent,
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "maskable" },
    ],
  };
}
