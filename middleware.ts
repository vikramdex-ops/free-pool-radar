import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "./lib/auth";

/**
 * Gate the internal routes (§80, §52).
 *
 * The check lives here rather than inside each page so that a new internal
 * route is protected by default: anything under /admin or /discovery requires
 * a valid session before a page component is ever invoked, which means a page
 * that forgets to check cannot leak by omission.
 *
 * Public routes are matched explicitly rather than by exclusion, so adding a
 * page later cannot accidentally open one up by default.
 */

const PROTECTED = ["/admin", "/discovery"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!isProtected) return NextResponse.next();

  // Signing in is the one public route under /admin, or it could never be
  // reached to obtain the cookie the other routes demand.
  if (pathname === "/admin/login") return NextResponse.next();

  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (await verifySessionToken(token)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  // Remember where they were headed so sign-in can return them there.
  if (pathname !== "/admin") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/discovery/:path*"],
};
