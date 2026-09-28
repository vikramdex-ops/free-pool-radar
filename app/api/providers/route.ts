import { getProviders } from "@/lib/db";
import { envelope } from "@/lib/publicData";
import { iso, stampUTC } from "@/lib/format";

export const revalidate = 300;

/** GET /api/providers — the provider registry (§37). */
export async function GET() {
  const providers = await getProviders();
  return envelope(
    providers.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      officialUrl: p.official_url,
      description: p.description,
      type: p.provider_type,
      country: p.country,
      status: p.status,
      freeModelCount: p.free_model_count,
      liveOfferCount: p.live_offer_count,
      lastVerifiedAt: iso(p.last_verified_at),
      lastVerifiedDisplay: stampUTC(p.last_verified_at),
    })),
    { count: providers.length },
  );
}
