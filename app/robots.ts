import type { MetadataRoute } from "next";

/**
 * PUL-001: crawl rules + sitemap pointer.
 *
 * Internal routes stay out of the index: /admin and /discovery are
 * operational pages (the login page already sets noindex), and /api
 * is data, not content.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/discovery", "/api/"],
    },
    sitemap: "https://free-pool-radar.vercel.app/sitemap.xml",
  };
}
