import path from "node:path";
import type { NextConfig } from "next";

/**
 * Content-Security-Policy, phase 1: Report-Only (CIP-003).
 *
 * The policy that will be enforced (identical, but under the enforcing
 * header) is stated here so the choice is reviewable rather than
 * discovered:
 *
 *   default-src 'self';
 *   script-src 'self' 'sha256-Kh3dS4sP6GIngNw9kdvwr0Pt6RxEEpE4EKJhqZ5VrQo=';
 *   style-src 'self' https://fonts.googleapis.com 'unsafe-inline';
 *   font-src 'self' https://fonts.gstatic.com;
 *   img-src 'self' data: https:;
 *   connect-src 'self' https://*.supabase.co;
 *   frame-ancestors 'self'; base-uri 'self'; form-action 'self';
 *   object-src 'none'; upgrade-insecure-requests
 *
 * (upgrade-insecure-requests is enforce-phase only: it is ignored in a
 * Report-Only policy and only adds console noise there.)
 *
 * What it would break, checked before enforcing:
 * - The theme init script (lib/theme.ts) is the only STATIC inline script
 *   and is allowlisted by exact hash (scripts/csp-hash.mjs) - proven clean
 *   in production (zero violations carry the theme hash). If theme.ts changes
 *   without updating the hash, the theme flash fix breaks visibly — fix the
 *   flash, never add 'unsafe-inline' for scripts; that makes a CSP
 *   decorative. scripts/test-csp-hash.mjs fails the build's conscience
 *   (not the build) if hash and config drift.
 * - App Router flight-data scripts (self.__next_f.push) are inline with
 *   per-request content and CANNOT be hashed. Measured in production:
 *   exactly one such violation per page, dozens of distinct hashes.
 *   Enforcement therefore needs nonce-via-proxy.ts (per-request nonce in
 *   x-nonce, which Next.js propagates to framework scripts) - and nonces
 *   force every page dynamic, killing the ISR/static generation this site
 *   relies on (revalidate 300, static model pages, CDN caching). That
 *   trade-off is Stark's call, not this PR's. Until then: Report-Only.
 * - React style attributes need style-src 'unsafe-inline' (low risk, kept).
 * - The pending JSON-LD branch adds inline ld+json scripts whose content is
 *   dynamic and cannot be hashed — reconcile before enforcing (nonce or
 *   per-route hash), or enforcement blocks structured data.
 * - Next.js dev-mode inline scripts violate in dev only, never in prod.
 */
const THEME_SCRIPT_HASH =
  "'sha256-Kh3dS4sP6GIngNw9kdvwr0Pt6RxEEpE4EKJhqZ5VrQo='";

const CSP_REPORT_ONLY = [
  "default-src 'self'",
  `script-src 'self' ${THEME_SCRIPT_HASH}`,
  "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self' https://*.supabase.co",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
].join(", ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // The git repository root is the parent directory, so Turbopack would
  // otherwise treat the parent as the project root and warn about the ignored
  // lockfile. Pinning the root to this directory keeps builds reproducible.
  turbopack: {
    root: path.resolve("."),
  },

  async headers() {
    return [
      {
        // The public API is meant to be called from anywhere, by scripts and
        // by other people's front ends.
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Content-Security-Policy-Report-Only",
            value: CSP_REPORT_ONLY,
          },
          { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
        ],
      },
    ];
  },
};

export default nextConfig;
