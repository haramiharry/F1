import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "F1 2026 Car Intelligence",
  description: "Premium motorsport intelligence platform — 2026 season",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Dark mode is the default. Add class="light" to switch.
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
