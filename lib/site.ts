/**
 * Single source of origin (APR-022).
 *
 * Reads NEXT_PUBLIC_SITE_URL, documented in .env.example and HANDOVER §2.
 * Defaults to the production origin so behaviour is unchanged where the
 * variable is unset. Trailing slashes are stripped so `${SITE_URL}/path`
 * never doubles them. Without this, every fork emits production canonicals
 * and sitemap entries - the classic cause of de-indexing for duplicate
 * content.
 */
const DEFAULT_ORIGIN = "https://free-pool-radar.vercel.app";

export const SITE_URL: string = (
  process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_ORIGIN
).replace(/\/+$/, "");
