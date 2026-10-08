import type { MetadataRoute } from "next";
import {
  getEndedOffers,
  getEvents,
  getLiveOffers,
  getModels,
  getProviders,
} from "@/lib/db";

/**
 * PUL-002: sitemap via the Next.js Metadata API.
 *
 * Slugs are enumerated from Supabase at generation time, never
 * hard-coded, and lastmod tracks the stored record (updated/verified
 * timestamps) so it stays maintained as data moves. When the database
 * is unreachable the sitemap still serves the static routes rather
 * than failing the whole file (invariant 9: a failed read is never
 * rendered as an empty result — and here, never as a 500 either).
 */

import { SITE_URL as SITE } from "@/lib/site";

/**
 * Force-dynamic on purpose (invariant 8, §76). Without this the App Router
 * prerenders the sitemap once at build time and bakes the slugs in: a newly
 * discovered provider, model or event would never reach /sitemap.xml until
 * somebody redeploys, which is exactly the redeploy-for-a-data-change the
 * product promises never to need. robots.ts stays prerendered — crawl rules
 * genuinely are static.
 */
export const dynamic = "force-dynamic";

const STATIC_ROUTES = [
  "/",
  "/live",
  "/search",
  "/events",
  "/providers",
  "/models",
  "/compare",
  "/timeline",
  "/methodology",
  "/developers",
  "/ecosystem",
];

function toDate(v: string | null | undefined): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((p) => ({
    url: `${SITE}${p}`,
    lastModified: now,
  }));

  try {
    const [providers, models, events, live, ended] = await Promise.all([
      getProviders(),
      getModels(),
      getEvents(),
      getLiveOffers(500),
      getEndedOffers(200),
    ]);

    // LED-001 turned every reader into a ReadResult, so a failed read is a
    // reported failure rather than a silently empty list. Each one is checked
    // on its own: a source that failed contributes no dynamic URLs and is
    // logged, while the static routes above are still served. Degrading one
    // source is better than failing the whole sitemap, and better than
    // publishing "this site has no providers".
    const providerError = providers.error;
    if (!providerError) {
      for (const p of providers.data) {
        entries.push({
          url: `${SITE}/providers/${p.slug}`,
          lastModified: toDate(p.last_verified_at ?? p.updated_at) ?? now,
        });
      }
    }

    if (!models.error) {
      for (const m of models.data) {
        entries.push({
          url: `${SITE}/models/${m.slug}`,
          lastModified: toDate(m.updated_at) ?? now,
        });
      }
    }

    if (!events.error) {
      for (const e of events.data) {
        entries.push({
          url: `${SITE}/events/${e.slug}`,
          lastModified: toDate(e.last_verified_at ?? e.discovered_at) ?? now,
        });
      }
    }

    const offerError = live.error ?? ended.error;
    if (!offerError) {
      const seen = new Set<number>();
      for (const o of [...live.data, ...ended.data]) {
        if (seen.has(o.id)) continue;
        seen.add(o.id);
        entries.push({
          url: `${SITE}/evidence/${o.id}`,
          lastModified:
            toDate(o.last_verified_at ?? o.first_verified_at) ?? now,
        });
      }
    }

    for (const [name, e] of Object.entries({
      providers: providerError,
      models: models.error,
      events: events.error,
      offers: offerError,
    })) {
      if (e) console.error(`[radar] sitemap ${name} read failed: ${e}`);
    }
  } catch (err) {
    console.error(`[radar] sitemap DB read failed: ${String(err)}`);
  }

  return entries;
}
