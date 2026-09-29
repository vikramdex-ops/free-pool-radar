/**
 * Elevated read access for the internal routes.
 *
 * The public site reads with the publishable key, which resolves to `anon` and
 * is subject to RLS — that is the whole point of it. The discovery queue is
 * different: its RLS policy grants `authenticated`, because a review queue
 * should not be world-readable even through the API.
 *
 * So internal pages use the secret key instead. That key bypasses RLS, which
 * makes it dangerous, and the danger is contained by construction rather than
 * by care:
 *
 *   - this module is only ever imported from /admin and /discovery
 *   - those routes are gated in middleware before a component runs
 *   - the key is read from a server-only variable with no NEXT_PUBLIC_ prefix,
 *     so it is never bundled into the client
 *
 * If you find yourself importing this from a public page, that is the bug.
 */

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function adminClient(): SupabaseClient | null {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** One registered source, as the internal pages need it. */
export interface AdminSource {
  id: number;
  provider_slug: string;
  url: string;
  health: "live" | "slow" | "degraded" | "failed" | "stale" | "disabled";
  last_status_code: number | null;
  last_latency_ms: number | null;
  last_ok_at: string | null;
  last_error: string | null;
  parser_key: string;
}

/**
 * The source registry, read with the elevated client.
 *
 * This deliberately does not reuse the public `getSources`. That one reads as
 * `anon`, the `sources` table is not readable by `anon`, and it returns an
 * empty array rather than an error. The result was an admin page that said
 * "the source registry is empty" while twelve sources were registered — a failed
 * read rendered as a confident false statement, which is the one thing an
 * operational page must never do.
 *
 * The error is returned rather than swallowed so the page can say it could not
 * read the registry, which is a different sentence from saying it is empty.
 */
export async function getSourcesAdmin(): Promise<{
  data: AdminSource[];
  error: string | null;
}> {
  const client = adminClient();
  if (!client) {
    return { data: [], error: "No server-side database credential is configured." };
  }
  const { data, error } = await client
    .from("sources")
    .select("*")
    .order("provider_slug");
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as AdminSource[], error: null };
}
