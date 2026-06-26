import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creative Strategist — Find & Generate Winning Ad Angles",
  description:
    "Reads what's winning in your vertical, scores your ad set for creative diversity, and generates a prioritized batch of net-new angles.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
