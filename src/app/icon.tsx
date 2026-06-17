import { ImageResponse } from "next/og";
import { BRAND, WALLET_PATH } from "@/lib/seo";

// Favicon — replaces the stock Next.js icon. Generated at build time, no asset file.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND.accent,
        borderRadius: 7,
      }}
    >
      <svg
        role="img"
        aria-label="Family Asset Tracker"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={WALLET_PATH} />
      </svg>
    </div>,
    { ...size },
  );
}
