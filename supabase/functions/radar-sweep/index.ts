// Free Pool Radar — scheduled sweep.
//
// Runs the full monitoring pipeline (§11):
//   collectors → normaliser → verifier → change detector → database
//
// Invoked on a pg_cron tick, which dispatches through pg_net carrying the
// project's secret key in the `apikey` header. That is the only credential
// involved: the platform verifies it, `auth: 'secret'` accepts it, and the
// database's EXECUTE grants restrict the RPCs to the service role. There is no
// second bespoke secret to keep in sync.
//
// This is not a public endpoint. It writes to the intelligence store, so it
// must never run as `auth: 'none'`. `verify_jwt = false` in
// supabase/config.toml only disables the platform's *user-JWT* check, which a
// cron caller cannot present; the secret key check in the handler is the gate.

import { withSupabase } from "npm:@supabase/server"
import { runSweep } from "./core/sweep.ts"

export default {
  fetch: withSupabase({ auth: "secret" }, async (req, ctx) => {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    // `supabaseAdmin` runs with the service role, so it bypasses RLS. Every
    // statement the sweep issues is a parameterised stored procedure, so a
    // collected value can only ever arrive as a bound parameter.
    const db = {
      async query<T = unknown>(fn: string, p: unknown[] = []): Promise<T[]> {
        const { data, error } = await ctx.supabaseAdmin.rpc(fn, { p })
        if (error) {
          // Include `details`, not just `message`. Postgres puts the failing
          // statement and the plpgsql line number in details, and without it a
          // function-level error arrives as a bare "operator does not exist"
          // with no way to tell which of several statements it came from.
          const where = error.details ? ` -- ${error.details}` : ""
          throw new Error(`${fn}: ${error.message}${where}`)
        }
        return (data ?? []) as T[]
      },
    }

    try {
      const report = await runSweep(db)
      return Response.json({
        ok: true,
        trigger: body.trigger ?? "cron",
        duration_ms: report.durationMs,
        sources_ok: report.sources.filter((s) => s.status === "ok").length,
        sources_total: report.sources.length,
        offers: report.offers,
        changes_created: report.changesCreated,
        offers_ended: report.offersEnded,
        models_created: report.modelsCreated,
        notes: report.notes,
        errors: report.errors,
      })
    } catch (err) {
      // A thrown error means the sweep itself broke, not that a source did:
      // individual source failures are already collected in report.errors.
      // This endpoint is gated on the project secret key, so returning the
      // stack is safe and is the most useful thing an operator can be given
      // when a sweep breaks.
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      console.error("radar sweep failed:", message, stack);
      return Response.json(
        { ok: false, error: message, stack },
        { status: 500 },
      )
    }
  }),
}
