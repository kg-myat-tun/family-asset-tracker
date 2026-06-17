import { ImageResponse } from "next/og";
import { APP_NAME, BRAND, SEO, WALLET_PATH } from "@/lib/seo";

// Link-preview card shown when the app URL is shared (chat apps, social, etc.).
export const alt = APP_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 96px",
        background: `linear-gradient(135deg, ${BRAND.accentStrong} 0%, ${BRAND.accent} 100%)`,
        color: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 132,
          height: 132,
          borderRadius: 28,
          background: "rgba(255,255,255,0.14)",
        }}
      >
        <svg
          role="img"
          aria-label="Family Asset Tracker"
          width="80"
          height="80"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={WALLET_PATH} />
        </svg>
      </div>
      <div style={{ marginTop: 48, fontSize: 76, fontWeight: 700, letterSpacing: -1 }}>
        {SEO.en.title}
      </div>
      <div style={{ marginTop: 20, fontSize: 34, color: "rgba(255,255,255,0.85)" }}>
        {SEO.en.description}
      </div>
    </div>,
    { ...size },
  );
}
