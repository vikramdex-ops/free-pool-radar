import path from "node:path";
import type { NextConfig } from "next";

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
        ],
      },
    ];
  },
};

export default nextConfig;
