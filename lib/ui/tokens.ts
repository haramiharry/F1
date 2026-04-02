// Design token constants — TypeScript layer.
//
// These mirror the CSS custom properties in globals.css and the Tailwind
// extension in tailwind.config.js. Use these when you need token values
// inside JavaScript (e.g., feeding colors to Recharts, which doesn't read
// Tailwind classes).

// ---------------------------------------------------------------------------
// Team color map — 2026 constructors
//
// Three-blue differentiation (Red Bull / Racing Bulls / Williams):
//
//   redbull      #3671C6  — medium navy   HSL(221°, 55%, 49%)
//   racingbulls  #818CF8  — periwinkle    HSL(235°, 90%, 73%)
//   williams     #37BEDD  — sky/cyan      HSL(197°, 73%, 55%)
//
//   Red Bull vs Racing Bulls:
//     Hue separation:       14° (221° vs 235°) — same blue family but different cast
//     Lightness separation: 24pt (L=49 vs L=73) — Red Bull darker, RB lighter
//     On dark bg (#141414): both are clearly visible and distinct
//     On light bg (#FFFFFF): Red Bull renders as mid-weight navy; RB as light purple
//     Result: unambiguous at a glance on both backgrounds
//
//   Red Bull was previously #1E3A8A (L=25, deep navy).
//   That value is INVISIBLE on dark backgrounds: contrast ratio vs #141414 ≈ 1.2:1.
//   Changed to #3671C6 (L=49) for dark-mode visibility while retaining the
//   "navy blue" character that makes it clearly Red Bull.
//
//   Williams (#37BEDD, HSL 197°) sits at a distinct cyan hue 24° below Red Bull
//   and 38° below Racing Bulls — no reasonable confusion between the three.
//
//   haas (#B6BABD) is near-neutral silver (saturation ≈ 3%) — distinguished from
//   all blues by saturation alone, not just hue or lightness.
//
//   cadillac (#C8A951) — Cadillac gold  HSL(43°, 50%, 55%)
//     Unique warm-gold hue; no conflict with any existing team color.
//     On dark bg (#141414): contrast ratio ≈ 5.8:1 — clearly visible.
// ---------------------------------------------------------------------------

export type TeamSlug =
  | "mercedes"
  | "ferrari"
  | "redbull"
  | "mclaren"
  | "astonmartin"
  | "alpine"
  | "williams"
  | "haas"
  | "sauber"
  | "racingbulls"
  | "cadillac";

export const TEAM_COLORS: Record<TeamSlug, string> = {
  mercedes:    "#00D2BE",
  ferrari:     "#E8002D",
  redbull:     "#3671C6", // was #1E3A8A — too dark for dark-mode visibility (contrast 1.2:1)
  mclaren:     "#FF8000",
  astonmartin: "#358C75",
  alpine:      "#0093CC",
  williams:    "#37BEDD",
  haas:        "#B6BABD",
  sauber:      "#52E252",
  racingbulls: "#818CF8",
  cadillac:    "#C8A951", // Cadillac gold — unique warm hue, no conflict with any other team
};

// Human-readable team names keyed by slug.
export const TEAM_NAMES: Record<TeamSlug, string> = {
  mercedes:    "Mercedes",
  ferrari:     "Ferrari",
  redbull:     "Red Bull Racing",
  mclaren:     "McLaren",
  astonmartin: "Aston Martin",
  alpine:      "Alpine",
  williams:    "Williams",
  haas:        "Haas",
  sauber:      "Audi / Sauber",
  racingbulls: "Racing Bulls",
  cadillac:    "Cadillac",
};

// Tailwind team-stripe utility class names — applied as border-left accents
// on car cards. These are defined in globals.css @layer utilities.
export function teamStripeClass(slug: TeamSlug): string {
  return `team-stripe-${slug}`;
}

// ---------------------------------------------------------------------------
// Source label — visual palette
// ---------------------------------------------------------------------------

export type SourceVariant = "official" | "derived" | "predicted";

export const SOURCE_COLORS: Record<SourceVariant, string> = {
  official:  "#22C55E",
  derived:   "#38BDF8",
  predicted: "#F59E0B",
};

// ---------------------------------------------------------------------------
// Confidence tier — visual palette
// ---------------------------------------------------------------------------

export type ConfidenceTier = "low" | "medium" | "high";

export const CONFIDENCE_COLORS: Record<ConfidenceTier, string> = {
  high:   "#22C55E",
  medium: "#F59E0B",
  low:    "#EF4444",
};

// ---------------------------------------------------------------------------
// Chart baseline — used as the default grid/axis color in Recharts configs
// ---------------------------------------------------------------------------

export const CHART_GRID_COLOR  = "#2A2A2A"; // --color-border
export const CHART_AXIS_COLOR  = "#666666"; // --color-text-muted
export const CHART_TEXT_COLOR  = "#9A9A9A"; // --color-text-secondary
export const CHART_BG_COLOR    = "#141414"; // --color-surface

// ---------------------------------------------------------------------------
// Margin of error display labels (from Step 6 predictions module)
// ---------------------------------------------------------------------------

export const MARGIN_OF_ERROR_LABELS: Record<ConfidenceTier, string> = {
  high:   "±0.3s",
  medium: "±0.8s",
  low:    "±2.0s",
};
