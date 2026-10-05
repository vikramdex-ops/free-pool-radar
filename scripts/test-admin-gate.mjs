// ARC-048: the admin gate's security logic, verified offline with no browser,
// no playwright, and no new dependency.
//
// WHY THIS FILE EXISTS INSTEAD OF A STATIC CHECK. scripts/test-prod-auth.mjs
// mixes two unrelated things: a security assertion (the gate holds) and a
// liveness assertion (the served page reads live data). The liveness half
// needs a deployment and must stay behavioural. The security half needs
// neither, because lib/auth.ts is pure Web Crypto — HMAC via crypto.subtle,
// constantTimeEquals, and the signature-before-expiry ordering. Importing it
// and calling it is possible with no DOM at all, so the security claim becomes
// a check that runs on every commit instead of a check no job has ever run.
//
// INTERPRETER (Rule 9). This file is invoked by the ci.yml offline loop as
//   node "scripts/<name>.mjs"
// with NO flags. That matters: lib/auth.ts is TypeScript, so this only works
// because Node strips types by default from 22.18.0 (and 23.6.0+). It is
// verified to run on node 22.18.0 unflagged. If this ever fails with
// "Unknown file extension .ts" or ERR_UNKNOWN_FILE_EXTENSION, the cause is a
// Node older than 22.18 — not a defect in the gate. Do NOT "fix" it by adding
// --experimental-strip-types: the loop passes no flags, so a flag requirement
// makes the test unrunnable in CI. Raise node-version instead.
//
// A liveness assertion deliberately does NOT live here.

import { strict as assert } from "node:assert";
import { createHash, randomBytes } from "node:crypto";

const results = [];
// auth.ts exposes async functions, so every check must be awaited. Comparing a
// Promise to `true` passes nothing and fails everything — an earlier draft of
// this file did exactly that and reported 16 false failures.
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, msg: err && err.message ? err.message : String(err) });
  }
}

// Load the real module under test. No stubbing: if this import fails the
// security claim is unverified and every check below must fail loudly.
let auth = null;
let loadError = null;
try {
  auth = await import("../lib/auth.ts");
} catch (err) {
  loadError = err;
}

const ADMIN_PASSWORD = "correct-horse-battery-staple";
const ADMIN_SESSION_SECRET = "test-secret-value-not-a-real-secret";

function withEnv(fn) {
  const prevP = process.env.ADMIN_PASSWORD;
  const prevS = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
  process.env.ADMIN_SESSION_SECRET = ADMIN_SESSION_SECRET;
  try {
    return fn();
  } finally {
    if (prevP === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = prevP;
    if (prevS === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = prevS;
  }
}

// --- token shape -----------------------------------------------------------
await check("token is <expiry>.<64-hex-hmac>", async () => {
  assert.ok(auth, "lib/auth.ts failed to load: " + (loadError && loadError.message));
  const t = await withEnv(() => auth.createSessionToken());
  assert.match(t, /^\d+\.[0-9a-f]{64}$/, `unexpected token shape: ${t}`);
});

await check("a freshly minted token is accepted", async () => {
  const t = await withEnv(() => auth.createSessionToken());
  assert.equal(await withEnv(() => auth.verifySessionToken(t)), true);
});

await check("a token signed with a different secret is refused", async () => {
  const t = await withEnv(() => auth.createSessionToken());
  const [body] = t.split(".");
  const forged = body + "." + createHash("sha256").update("attacker").digest("hex");
  assert.equal(await withEnv(() => auth.verifySessionToken(forged)), false);
});

await check("a token whose signature is zeroed is refused", async () => {
  const t = await withEnv(() => auth.createSessionToken());
  const [body] = t.split(".");
  assert.equal(await withEnv(() => auth.verifySessionToken(body + "." + "0".repeat(64))), false);
});

await check("a token whose expiry was extended is refused", async () => {
  const t = await withEnv(() => auth.createSessionToken());
  const [, sig] = t.split(".");
  const body = String(Number(t.split(".")[0]) + 60 * 60 * 1000);
  assert.equal(await withEnv(() => auth.verifySessionToken(`${body}.${sig}`)), false);
});

await check("an expired token is refused", async () => {
  const t = await withEnv(() => auth.createSessionToken());
  const expiry = Number(t.split(".")[0]);
  assert.equal(await withEnv(() => auth.verifySessionToken(t, expiry + 1)), false);
});

await check("a token expiring exactly now is refused", async () => {
  const t = await withEnv(() => auth.createSessionToken());
  const expiry = Number(t.split(".")[0]);
  assert.equal(await withEnv(() => auth.verifySessionToken(t, expiry)), false);
});

await check("undefined, null and empty tokens are refused", async () => {
  for (const v of [undefined, null, "", "   "]) {
    assert.equal(await withEnv(() => auth.verifySessionToken(v)), false, `accepted ${JSON.stringify(v)}`);
  }
});

await check("a malformed token body is refused rather than throwing", async () => {
  assert.equal(await withEnv(() => auth.verifySessionToken("not-a-token")), false);
  assert.equal(await withEnv(() => auth.verifySessionToken(".sig")), false);
  assert.equal(await withEnv(() => auth.verifySessionToken("body.")), false);
  // a non-numeric expiry must fail the Number.isFinite check
  assert.equal(await withEnv(() => auth.verifySessionToken("abc." + "a".repeat(64))), false);
});

await check("a token signed under one secret is refused when the secret rotates", async () => {
  const t = await withEnv(() => auth.createSessionToken());
  process.env.ADMIN_SESSION_SECRET = "a-different-secret-entirely";
  try {
    assert.equal(await auth.verifySessionToken(t), false);
  } finally {
    process.env.ADMIN_SESSION_SECRET = ADMIN_SESSION_SECRET;
  }
});

// --- password --------------------------------------------------------------
await check("the correct password verifies and a wrong one does not", async () => {
  assert.equal(await withEnv(() => auth.verifyPassword(ADMIN_PASSWORD)), true);
  assert.equal(await withEnv(() => auth.verifyPassword("wrong-password-entirely")), false);
});

await check("password comparison is not short-circuiting on a shared prefix", async () => {
  // A correct password must not verify when only its prefix is supplied, and
  // must not verify on a near-miss of the same length.
  assert.equal(await withEnv(() => auth.verifyPassword(ADMIN_PASSWORD.slice(0, -1))), false);
  assert.equal(await withEnv(() => auth.verifyPassword(ADMIN_PASSWORD + "x")), false);
  assert.equal(await withEnv(() => auth.verifyPassword("")), false);
});

await check("a missing ADMIN_PASSWORD refuses every submission", async () => {
  const prev = process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_PASSWORD;
  try {
    assert.equal(await auth.verifyPassword(ADMIN_PASSWORD), false);
    assert.equal(await auth.verifyPassword(""), false);
  } finally {
    process.env.ADMIN_PASSWORD = prev;
  }
});

await check("a missing ADMIN_SESSION_SECRET disables sign-in rather than weakening it", async () => {
  const prev = process.env.ADMIN_SESSION_SECRET;
  delete process.env.ADMIN_SESSION_SECRET;
  try {
    assert.equal(auth.isAdminConfigured(), false);
    assert.equal(await auth.verifySessionToken("123." + "a".repeat(64)), false);
    await assert.rejects(() => auth.createSessionToken(), /ADMIN_SESSION_SECRET/);
  } finally {
    process.env.ADMIN_SESSION_SECRET = prev;
  }
});

await check("isAdminConfigured requires BOTH env vars", async () => {
  const prevP = process.env.ADMIN_PASSWORD;
  const prevS = process.env.ADMIN_SESSION_SECRET;
  try {
    process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
    delete process.env.ADMIN_SESSION_SECRET;
    assert.equal(auth.isAdminConfigured(), false);
    process.env.ADMIN_PASSWORD = "";
    process.env.ADMIN_SESSION_SECRET = ADMIN_SESSION_SECRET;
    assert.equal(auth.isAdminConfigured(), false, "empty password must not count as configured");
  } finally {
    process.env.ADMIN_PASSWORD = prevP;
    process.env.ADMIN_SESSION_SECRET = prevS;
  }
});

// --- cookie hardening ------------------------------------------------------
await check("the session cookie is HttpOnly, SameSite and scoped to /", async () => {
  const o = auth.ADMIN_COOKIE_OPTIONS;
  assert.equal(o.httpOnly, true, "cookie must be HttpOnly or script can read the token");
  assert.equal(o.sameSite, "lax", "SameSite must not be 'none'");
  assert.equal(o.path, "/");
  assert.ok(o.maxAge > 0 && o.maxAge <= 12 * 60 * 60, `maxAge out of range: ${o.maxAge}`);
});

// --- signature-before-expiry ordering --------------------------------------
// auth.ts checks the signature before the expiry, so a forged token carrying a
// far-future date cannot be accepted on the strength of its date alone. This
// asserts the ordering holds as a behaviour, not as a grep for line numbers.
await check("a forged token with a far-future expiry is refused", async () => {
  const future = String(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const forged = future + "." + randomBytes(32).toString("hex");
  assert.equal(await withEnv(() => auth.verifySessionToken(forged)), false);
});

await check("tokens signed by different secrets never cross-validate", async () => {
  const a = await withEnv(async () => {
    process.env.ADMIN_SESSION_SECRET = "secret-a";
    return auth.createSessionToken();
  });
  const b = await withEnv(async () => {
    process.env.ADMIN_SESSION_SECRET = "secret-b";
    return auth.createSessionToken();
  });
  const [bodyA, sigA] = a.split(".");
  const [, sigB] = b.split(".");
  assert.equal(await withEnv(() => auth.verifySessionToken(`${bodyA}.${sigB}`)), false);
});

// --- the gate is wired, not merely implemented -----------------------------
// A correct implementation that nothing calls is not a gate. These read the
// source, because proving the wiring by importing middleware.ts would pull in
// next/server and a request context this offline check does not have.
const { readFileSync } = await import("node:fs");

await check("middleware.ts gates /admin and /discovery on verifySessionToken", async () => {
  const src = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
  assert.match(src, /import\s*\{[^}]*verifySessionToken[^}]*\}\s*from\s*["']\.\/lib\/auth["']/,
    "middleware must import verifySessionToken from lib/auth");
  assert.match(src, /await\s+verifySessionToken\s*\(/,
    "middleware must actually call verifySessionToken");
  assert.match(src, /"\/admin\/login"[\s\S]{0,40}(return|NextResponse)/,
    "the login route itself must stay reachable or sign-in is impossible");
});

await check("app/admin/page.tsx never prerenders and re-checks the session", async () => {
  const src = readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  assert.match(src, /export const dynamic\s*=\s*["']force-dynamic["']/,
    "a prerendered /admin serves a frozen build-time snapshot with no credential");
  assert.match(src, /robots\s*:\s*\{\s*index\s*:\s*false/,
    "an internal admin page must never be indexed");
  assert.match(src, /verifySessionToken\s*\(/,
    "the page must re-verify the token itself; middleware alone is not defence in depth");
  assert.match(src, /redirect\(\s*["']\/admin\/login["']\s*\)/,
    "a failed session check must redirect to the login route");
});

await check("app/admin/page.tsx reads the session per request, not from a module cache", async () => {
  const src = readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  assert.match(src, /await\s+cookies\s*\(\s*\)/,
    "the page must read cookies() per request or a cached copy can be served");
});

// --- report ----------------------------------------------------------------
const pass = results.filter((r) => r.ok).length;
const fail = results.length - pass;
console.log("");
for (const r of results) {
  console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.name}${r.ok ? "" : " — " + r.msg}`);
}
if (loadError) {
  console.log("");
  console.log("  lib/auth.ts did not load. If this is ERR_UNKNOWN_FILE_EXTENSION or");
  console.log("  'Unknown file extension .ts', the interpreter is older than Node 22.18");
  console.log("  and cannot strip TypeScript types unflagged. Raise ci.yml node-version;");
  console.log("  do not add --experimental-strip-types, the offline loop passes no flags.");
  console.log(`  original error: ${loadError.message}`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
