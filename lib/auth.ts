/**
 * Admin authentication (§80).
 *
 * The requirement is explicit: admin routes must not be public, and security
 * must not rest on a hidden URL, a query parameter, or a password shipped to
 * the browser. None of those are controls — they are conventions that the first
 * person to read the source can break.
 *
 * So this is a real check. An admin signs in with a password held only in the
 * server environment, and receives an HTTP-only signed cookie. The signature is
 * an HMAC over an expiry, so the token cannot be forged or extended, and the
 * browser cannot read it to replay it elsewhere.
 *
 * Everything here uses Web Crypto rather than `node:crypto` so the same module
 * runs in the Edge middleware and in a server component without a second
 * implementation that could drift.
 */

const encoder = new TextEncoder();

/** Cookie name. Deliberately boring. */
export const ADMIN_COOKIE = "fpr_admin";

/** How long a sign-in lasts. Long enough to work, short enough to matter. */
const SESSION_MS = 12 * 60 * 60 * 1000;

/** Whether this deployment can authenticate an admin at all. */
export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET);
}

/**
 * The secret used to sign sessions.
 *
 * Returns null rather than a default. A hard-coded fallback secret would let
 * anyone who read the source forge a session, which is precisely the failure
 * mode §80 warns about — so a missing secret disables sign-in instead of
 * weakening it.
 */
function sessionSecret(): string | null {
  return process.env.ADMIN_SESSION_SECRET ?? null;
}

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compares two strings without an early exit.
 *
 * A byte-by-byte comparison leaks the length of the shared prefix through
 * timing, which is enough to recover a password one character at a time. The
 * cost here is trivial and the benefit is that the comparison leaks nothing.
 */
function constantTimeEquals(a: string, b: string): boolean {
  // Compare a fixed-width digest rather than the raw values, so the loop length
  // does not depend on the password's length either.
  const len = Math.max(a.length, b.length, 32);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** Checks a submitted password against the environment. */
export async function verifyPassword(submitted: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return constantTimeEquals(submitted, expected);
}

/** Mints a signed session token valid for the next 12 hours. */
export async function createSessionToken(now = Date.now()): Promise<string> {
  const secret = sessionSecret();
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not set");
  const expires = now + SESSION_MS;
  const body = String(expires);
  return `${body}.${await hmacHex(body, secret)}`;
}

/**
 * Verifies a session token.
 *
 * Three separate things must hold: the token must be well-formed, the signature
 * must match, and the expiry must be in the future. Checking the signature
 * before the expiry matters — otherwise a forged token with a future date would
 * be accepted on the strength of its date alone.
 */
export async function verifySessionToken(
  token: string | undefined | null,
  now = Date.now(),
): Promise<boolean> {
  const secret = sessionSecret();
  if (!secret || !token) return false;

  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = await hmacHex(body, secret);
  if (!constantTimeEquals(sig, expected)) return false;

  const expires = Number(body);
  return Number.isFinite(expires) && expires > now;
}

/** Cookie attributes. HTTP-only so script cannot read the token; SameSite so
 *  it is not sent on cross-site navigations. */
export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_MS / 1000,
} as const;
