import { ImageResponse } from "next/og";

/**
 * Social preview image (PUL-003), 1200x630.
 *
 * Generated at request time by Next.js, so there is no binary asset to
 * keep in sync. Content is brand + tagline only: no ranking language
 * anywhere (invariant 1), and the alt text says the same.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "96px",
          background: "#06080c",
          color: "#e9eef6",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 28,
            letterSpacing: 8,
            color: "#a2b2c6",
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              background: "#3ddc84",
              marginRight: 20,
            }}
          />
          FREE POOL RADAR
        </div>
        <div style={{ fontSize: 76, fontWeight: 700, marginTop: 32, lineHeight: 1.1 }}>
          Every free AI inference pool.
        </div>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>
          Every disappearing quota.
        </div>
        <div style={{ fontSize: 30, marginTop: 28, color: "#a2b2c6" }}>
          One live radar.
        </div>
      </div>
    ),
    { ...size },
  );
}
