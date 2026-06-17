import { ImageResponse } from "next/og";
import { BRAND, WALLET_PATH } from "@/lib/seo";

// Apple touch / home-screen icon.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND.accent,
      }}
    >
      <svg
        role="img"
        aria-label="Family Asset Tracker"
        width="108"
        height="108"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={WALLET_PATH} />
      </svg>
    </div>,
    { ...size },
  );
}
