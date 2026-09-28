import { upcomingPayload } from "@/lib/publicData";

export const revalidate = 300;

/** GET /api/upcoming — announced pools and events, chronologically. */
export async function GET() {
  return upcomingPayload();
}
