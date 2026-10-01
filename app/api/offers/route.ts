import { NextResponse } from "next/server";

/**
 * GET /api/offers — alias for the canonical /api/live.
 *
 * CANONICAL IS /api/live. Both routes once served the same payload body
 * from separate ISR entries, so the two URLs could disagree for up to 360
 * seconds after a data write (SEN-005). A redirect makes byte-identity structural: one body, nothing
 * to invalidate, nothing that can go stale.
 *
 * 307 (not 308): temporary, so intermediaries must not cache it
 * permanently; we may reverse this. fetch, curl and requests follow it by
 * default. Deliberate tradeoff, on the record: this keeps the 360-second
 * freshness window instead of invalidating on sweep, trading freshness-now
 * for the absence of a silent-freeze mode.
 */
export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/api/live", request.url), 307);
}
