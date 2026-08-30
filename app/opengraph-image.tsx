import { ImageResponse } from "next/og";

import { siteConfig } from "@/lib/config";

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default share card for the site (PRD §76). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#000",
          color: "#fff",
        }}
      >
        <div style={{ fontSize: 34, letterSpacing: 8, opacity: 0.7 }}>
          {siteConfig.name.toUpperCase()}
        </div>
        <div
          style={{
            fontSize: 82,
            fontWeight: 800,
            lineHeight: 1.05,
            marginTop: 24,
            maxWidth: 900,
          }}
        >
          {siteConfig.tagline}
        </div>
        <div style={{ fontSize: 30, opacity: 0.65, marginTop: 32, maxWidth: 880 }}>
          Real-world people-watching bingo. Scan a code, get your own card, play
          together.
        </div>
      </div>
    ),
    size
  );
}
