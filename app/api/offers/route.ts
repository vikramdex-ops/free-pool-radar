import { livePayload } from "@/lib/publicData";

export const revalidate = 300;

/** GET /api/offers — every currently usable free route. */
export async function GET() {
  return livePayload();
}
