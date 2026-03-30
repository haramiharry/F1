// Footer — non-primary destinations + required methodology disclosures.
//
// Rules Explainer and Methodology are footer links, NOT in primary nav.
// This is intentional: they are reference destinations, not live-updating
// return destinations. Primary nav is reserved for the four live views.

import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface mt-auto">
      <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Branding */}
          <div>
            <p className="text-data-small font-semibold text-text-primary">
              <span className="text-f1">F1</span> 2026 Car Intelligence
            </p>
            <p className="text-caption text-text-muted mt-0.5">
              Data sourced from Formula1.com and FIA documents.
              Not affiliated with Formula 1, the FIA, or any constructor.
            </p>
          </div>

          {/* Reference links */}
          <nav aria-label="Reference pages" className="flex flex-wrap gap-x-4 gap-y-1">
            <Link
              href="/rules"
              className="text-caption text-text-secondary hover:text-text-primary transition-colors"
            >
              2026 Rules Explainer
            </Link>
            <Link
              href="/methodology"
              className="text-caption text-text-secondary hover:text-text-primary transition-colors"
            >
              Methodology &amp; Sources
            </Link>
            <span className="text-caption text-text-muted">
              Season 2026
            </span>
          </nav>
        </div>
      </div>
    </footer>
  );
}
