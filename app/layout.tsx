import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Nav } from "@/components/layout/nav";
import { Footer } from "@/components/layout/footer";
import { AmendmentPanel } from "@/components/layout/amendment-panel";

export const metadata: Metadata = {
  title: {
    template: "%s — F1 2026 Car Intelligence",
    default: "F1 2026 Car Intelligence",
  },
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
      <body className="flex flex-col min-h-screen bg-bg text-text-primary">
        {/* Nav renders a top bar on md+ and a bottom tab bar on mobile */}
        <Nav />

        {/* Main content area.
            pb-16 on mobile reserves space above the fixed bottom tab bar.
            md:pb-0 removes that padding on desktop. */}
        <main className="flex-1 pb-16 md:pb-0">
          {children}
        </main>

        <Footer />

        {/* AmendmentPanel is globally available: any page that sets
            ?amendmentHistory=entityType:entityId will trigger it.
            Wrapped in Suspense because it calls useSearchParams(). */}
        <Suspense fallback={null}>
          <AmendmentPanel />
        </Suspense>
      </body>
    </html>
  );
}
