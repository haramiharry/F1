"use client";

// Primary navigation — four items only.
//
// Mobile  (default): fixed bottom tab bar with icon + label.
//   Sits above browser chrome; body gets pb-16 via the Shell to prevent overlap.
// Desktop (md:):     sticky top bar with horizontal link group.
//
// Active state is determined by pathname prefix match, not exact match, so
// /cars/mercedes still highlights the Cars tab.
//
// Non-primary destinations (Rules, Methodology) are in the Footer, not here.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Car, MapPin, Radio } from "lucide-react";

const NAV_ITEMS = [
  { href: "/",        label: "Dashboard", icon: LayoutDashboard, matchPrefix: "/" },
  { href: "/cars",    label: "Cars",      icon: Car,             matchPrefix: "/cars" },
  { href: "/tracks",  label: "Tracks",    icon: MapPin,          matchPrefix: "/tracks" },
  { href: "/weekend", label: "Weekend",   icon: Radio,           matchPrefix: "/weekend" },
] as const;

export function Nav() {
  const pathname = usePathname();

  function isActive(matchPrefix: string): boolean {
    if (matchPrefix === "/") return pathname === "/";
    return pathname.startsWith(matchPrefix);
  }

  return (
    <>
      {/* ── Desktop top bar ── */}
      <header className="hidden md:block sticky top-0 z-40 bg-surface border-b border-border">
        <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Wordmark */}
          <Link href="/" className="flex items-center gap-2 select-none">
            <span className="text-f1 font-bold text-data-medium tracking-tight">F1</span>
            <span className="text-text-primary font-semibold text-data-small">
              2026 Car Intelligence
            </span>
          </Link>

          {/* Nav links */}
          <nav aria-label="Primary navigation" className="flex items-center gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon, matchPrefix }) => {
              const active = isActive(matchPrefix);
              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-badge text-label uppercase transition-colors",
                    active
                      ? "bg-f1/15 text-f1"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated",
                  ].join(" ")}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={14} aria-hidden />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ── Mobile bottom tab bar ── */}
      <nav
        aria-label="Primary navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-4 h-14">
          {NAV_ITEMS.map(({ href, label, icon: Icon, matchPrefix }) => {
            const active = isActive(matchPrefix);
            return (
              <Link
                key={href}
                href={href}
                className={[
                  "flex flex-col items-center justify-center gap-0.5 transition-colors",
                  active ? "text-f1" : "text-text-muted hover:text-text-secondary",
                ].join(" ")}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={20} aria-hidden />
                <span className="text-caption uppercase tracking-wider">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
