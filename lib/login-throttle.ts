/**
 * Serverless-safe admin login throttle (CIP-002).
 *
 * An in-memory Map cannot work here: Vercel fans requests out across
 * instances, each with its own memory, so an attacker simply spreads
 * attempts and never trips a local counter. Attempt state therefore
 * lives in Postgres behind two SECURITY DEFINER RPCs (migration 0013).
 *
 * Policy: MAX_ATTEMPTS failed attempts per WINDOW_MINUTES per client
 * IP. Successes never count. When the store is unreachable the check
 * fails open (returns false) so a database outage cannot lock the
 * admin out; the failure is logged and the password check still runs.
 */

import { headers } from "next/headers";
import { adminClient } from "./admin-db";

export const LOGIN_MAX_ATTEMPTS = 10;
export const LOGIN_WINDOW_MINUTES = 15;

/**
 * Pure budget check, kept separate so it is unit-testable without a
 * database. `failedAt` holds epoch-ms timestamps of FAILED attempts
 * only; anything outside the window is ignored.
 */
export function isBlockedByFailures(
  failedAt: number[],
  now = Date.now(),
  maxAttempts = LOGIN_MAX_ATTEMPTS,
  windowMinutes = LOGIN_WINDOW_MINUTES,
): boolean {
  const windowMs = Math.max(windowMinutes, 1) * 60 * 1000;
  let recent = 0;
  for (const t of failedAt) {
    if (Number.isFinite(t) && t <= now && now - t < windowMs) {
      recent++;
      if (recent >= Math.max(maxAttempts, 1)) return true;
    }
  }
  return false;
}

/** Best-effort client IP from proxy headers. Never throws. */
export async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    if (forwarded) {
      const first = forwarded.split(",")[0]?.trim();
      if (first) return first.slice(0, 64);
    }
    const real = h.get("x-real-ip")?.trim();
    if (real) return real.slice(0, 64);
  } catch {
    // headers() outside a request context: fall through to unknown.
  }
  return "unknown";
}

/** True when this IP exhausted its failed-login budget. Fail-open. */
export async function isLoginBlocked(ip: string): Promise<boolean> {
  try {
    const client = adminClient();
    if (!client) return false;
    const { data, error } = await client.rpc("rpc_login_blocked", {
      p_ip: ip,
      p_max_attempts: LOGIN_MAX_ATTEMPTS,
      p_window_minutes: LOGIN_WINDOW_MINUTES,
    });
    if (error) {
      console.error(`[radar] login throttle check failed: ${error.message}`);
      return false;
    }
    return data === true;
  } catch (err) {
    console.error(`[radar] login throttle check failed: ${String(err)}`);
    return false;
  }
}

/** Records one attempt. Never throws; a lost row is not a login error. */
export async function recordLoginAttempt(
  ip: string,
  success: boolean,
): Promise<void> {
  try {
    const client = adminClient();
    if (!client) return;
    const { error } = await client.rpc("rpc_record_login_attempt", {
      p_ip: ip,
      p_success: success,
    });
    if (error) console.error(`[radar] login attempt log failed: ${error.message}`);
  } catch (err) {
    console.error(`[radar] login attempt log failed: ${String(err)}`);
  }
}
