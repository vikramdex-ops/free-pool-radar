import { NextResponse } from "next/server";

/**
 * POST /api/csp-report - the destination named by `report-uri` in the
 * report-only Content-Security-Policy (APR-026, ratified 2026-10-05).
 *
 * Why this route exists: a report-only policy that names no destination
 * enforces nothing and reports nothing, because a violation has nowhere to go.
 * That made CIP-003's recorded follow-up condition - "enforce once no
 * violations are reported" - unsatisfiable rather than merely unmet, because no
 * violation could ever be reported. This route is that destination.
 *
 * What it does NOT do, deliberately:
 *
 * - It does not enforce. The policy stays report-only. Enforcing is the next
 *   step and it is not this route's job; see the block comment above for why
 *   enforcement needs a per-request nonce and what that costs.
 * - It does not persist. There is no table for violations and no agent is
 *   authorised to add one without the owner. It acknowledges receipt with 204
 *   and returns the count it saw, so the endpoint is provably receiving before
 *   anyone relies on it for a decision.
 * - It does not echo the report body. A CSP report is attacker-influenceable;
 *   reflecting it into a response is free reflected content for no benefit.
 *
 * POST only. A GET returns 405 rather than a page, so this never appears in a
 * crawl or in someone's sitemap thinking it is content.
 */
export async function POST(request: Request) {
  // Best-effort read. A malformed or oversized body is still a report; the
  // point of the endpoint is to be reachable, not to be a strict parser.
  let seen = 0;
  try {
    const body = await request.text();
    // Count what arrived without interpreting it. A report is a JSON array of
    // violation records; counting its top-level entries is enough to answer
    // "did anything reach us" without trusting any of its contents.
    if (body.trim().startsWith("[")) {
      seen = JSON.parse(body).length;
    } else if (body.trim().length > 0) {
      seen = 1;
    }
  } catch {
    // Unparseable body, empty body, or an aborted upload. Acknowledge anyway:
    // a 4xx here would make browsers retry a violation report forever.
  }

  return new NextResponse(null, {
    status: 204,
    headers: {
      // Reports are telemetry, not content. Never cached, never stored.
      "cache-control": "no-store",
      "x-csp-reports-received": String(seen),
    },
  });
}

export async function GET() {
  return NextResponse.json(
    {
      error: "method_not_allowed",
      detail:
        "This is the report-only Content-Security-Policy report endpoint. It accepts POST and returns nothing else.",
    },
    { status: 405, headers: { "cache-control": "no-store" } },
  );
}