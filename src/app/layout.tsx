import type { Metadata } from "next";

import { CongratsTicker } from "@/components/congrats-ticker";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sketch → Photoreal",
  description: "Turn fashion sketches into photorealistic catalogue images",
};

/**
 * System/local fonts only — avoids Google Fonts network fetch during Docker builds.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <CongratsTicker />
        {children}
      </body>
    </html>
  );
}
