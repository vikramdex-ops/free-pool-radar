import { livePayload } from "@/lib/publicData";

export const revalidate = 300;

/** GET /api/live — the same live set, named for the "what works now" question. */
export async function GET() {
  return livePayload();
}
