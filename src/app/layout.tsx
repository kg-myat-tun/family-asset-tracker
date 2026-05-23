import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Family Asset Tracker",
  description: "Track your family's assets and loans across currencies.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
