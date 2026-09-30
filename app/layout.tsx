import type { Metadata, Viewport } from "next";
import "./globals.css";
import { themeInitScript } from "@/lib/theme";
import { JsonLd, websiteSchema } from "@/components/JsonLd";
import { SiteNav } from "@/components/SiteNav";
import { ThemeToggle } from "@/components/ThemeToggle";

const SITE_DESCRIPTION =
  "Live tracker of free AI inference pools: quotas, card rules, verification times, official sources and withdrawn history.";

export const metadata: Metadata = {
  metadataBase: new URL("https://free-pool-radar.vercel.app"),
  title: {
    default: "Free Pool Radar — every free AI inference pool, tracked live",
    template: "%s · Free Pool Radar",
  },
  description:
    "The live intelligence layer for $0 AI inference. Shared token pools, free model endpoints, sponsored access, promotional credits and keyless routes — with exact quotas, card requirements, verification times, official sources, and the history of what has been withdrawn.",
  keywords: [
    "free llm api",
    "free ai api no credit card",
    "free openai compatible api",
    "free anthropic compatible api",
    "shared token pool",
    "free claude api",
    "free gpt api",
    "free qwen api",
    "free llama api",
    "free ai inference",
    "sponsored inference",
    "keyless api",
  ],
  openGraph: {
    title: "Free Pool Radar",
    description:
      "Every free AI inference pool. Every disappearing quota. One live radar.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#06080c" },
    { media: "(prefers-color-scheme: light)", color: "#f2f4f7" },
  ],
  width: "device-width",
  initialScale: 1,
};

/**
 * The root layout.
 *
 * `data-theme="dark"` is the server-rendered default (§43); the pre-paint script
 * below then applies a stored preference before first paint, so the sheet never
 * flashes the wrong theme. `suppressHydrationWarning` is on the html element
 * because that script legitimately changes the attribute before React hydrates.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Archivo+Narrow:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <JsonLd data={websiteSchema(SITE_DESCRIPTION)} />
        <a href="#main" className="skip">
          Skip to content
        </a>
        <SiteNav />
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
