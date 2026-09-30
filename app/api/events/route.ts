import { getEvents } from "@/lib/db";
import { envelope, readErrorResponse } from "@/lib/publicData";
import { iso, stampUTC } from "@/lib/format";

export const revalidate = 300;

/** GET /api/events — shared pools and promotional events (§37, §7.4). */
export async function GET() {
  const { data: events, error: eventsError } = await getEvents();
  if (eventsError) return readErrorResponse("events");
  return envelope(
    events.map((e) => ({
      id: e.id,
      slug: e.slug,
      name: e.name,
      description: e.description,
      provider: e.provider?.name ?? null,
      providerSlug: e.provider?.slug ?? null,
      status: e.status,
      startAt: iso(e.start_at),
      endAt: iso(e.end_at),
      poolSize: e.pool_size,
      poolRemaining: e.pool_remaining,
      unit: e.unit,
      models: e.models,
      eligibility: e.eligibility,
      requirements: e.requirements,
      exhaustionCondition: e.exhaustion_condition,
      officialUrl: e.official_url,
      announcedAt: iso(e.announced_at),
      lastVerifiedAt: iso(e.last_verified_at),
      lastVerifiedDisplay: stampUTC(e.last_verified_at),
    })),
    { count: events.length },
  );
}
