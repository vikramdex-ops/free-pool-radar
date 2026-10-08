import { getEvents } from "@/lib/db";
import { envelope, readErrorResponse, serialiseEvent } from "@/lib/publicData";

export const revalidate = 300;

/** GET /api/events — shared pools and promotional events (§37, §7.4). */
export async function GET() {
  const { data: events, error: eventsError } = await getEvents();
  if (eventsError) return readErrorResponse("events");
  return envelope(events.map(serialiseEvent), { count: events.length });
}
