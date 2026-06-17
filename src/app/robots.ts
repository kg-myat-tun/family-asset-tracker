import type { MetadataRoute } from "next";

// This is a private, auth-gated family app: nothing should be crawled or indexed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
