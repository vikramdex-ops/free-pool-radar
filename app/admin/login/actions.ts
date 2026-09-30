"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_COOKIE,
  ADMIN_COOKIE_OPTIONS,
  createSessionToken,
  isAdminConfigured,
  verifyPassword,
} from "@/lib/auth";
import {
  getClientIp,
  isLoginBlocked,
  recordLoginAttempt,
} from "@/lib/login-throttle";

/**
 * Signs an admin in.
 *
 * The submitted password is checked on the server and the comparison is
 * constant-time. Nothing about the expected password is ever sent to the
 * browser, and the form contains no credentials of its own.
 *
 * A failure redirects back with `?error=…` rather than using useActionState.
 * The page is a server component and this keeps it one: a client wrapper would
 * be added purely to hold an error string, and would ship the form's state to
 * the browser for no gain.
 */
export async function signIn(formData: FormData): Promise<void> {
  const password = formData.get("password");
  const next = formData.get("next");
  const ip = await getClientIp();

  if (await isLoginBlocked(ip)) {
    redirect(failUrl(next, "throttled"));
    return;
  }

  // redirect() throws, so these calls never come back. The explicit `return`s
  // are what let the compiler know that: a `never`-typed arrow const is not
  // enough for control-flow narrowing, and without them `password` stays typed
  // as a FormDataEntryValue all the way down.
  if (typeof password !== "string" || password.length === 0) {
    await recordLoginAttempt(ip, false);
    redirect(failUrl(next, "wrong"));
    return;
  }

  if (!isAdminConfigured()) {
    // Deliberately vague. Naming the missing variables would tell an
    // unauthenticated visitor exactly which environment variables this
    // deployment expects, and where to set them.
    redirect(failUrl(next, "unconfigured"));
    return;
  }

  if (!(await verifyPassword(password))) {
    // The same code as an empty submission, so the form cannot be used to probe
    // whether a guess was close to anything.
    await recordLoginAttempt(ip, false);
    redirect(failUrl(next, "wrong"));
    return;
  }

  await recordLoginAttempt(ip, true);

  const store = await cookies();
  store.set(ADMIN_COOKIE, await createSessionToken(), ADMIN_COOKIE_OPTIONS);
  redirect(safeNext(next));
}

/**
 * Builds the URL to return to after a failed sign-in.
 *
 * The reason travels as one of two fixed codes, never as free text, so nothing
 * the server wants to say about itself is echoed into a URL that access logs
 * and referrer headers tend to keep.
 */
function failUrl(
  next: FormDataEntryValue | null,
  code: "wrong" | "unconfigured" | "throttled",
): string {
  const target = safeNext(next);
  // /admin is the default, so there is nothing worth preserving in that case.
  const back = target === "/admin" ? "" : `&next=${encodeURIComponent(target)}`;
  return `/admin/login?error=${code}${back}`;
}

/**
 * Only ever returns a same-site absolute path.
 *
 * An open redirect here would let a crafted login link sign a real admin in
 * and then bounce them to an attacker's page with the session intact.
 */
function safeNext(next: FormDataEntryValue | null): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/admin";
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

/** The host the request arrived on, used to build absolute same-origin URLs. */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
