import { endedPayload } from "@/lib/publicData";

export const revalidate = 300;

/**
 * GET /api/ended — withdrawn free access, retained permanently (§16, §24).
 *
 * This route is not a footnote. A provider that dropped its free tier is a
 * durable answer, and a consumer building on top of this API needs the same
 * history a page reader gets.
 */
export async function GET() {
  return endedPayload();
}
