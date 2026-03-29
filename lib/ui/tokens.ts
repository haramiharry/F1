// Design token constants — TypeScript layer.
//
// These mirror the CSS custom properties in globals.css and the Tailwind
// extension in tailwind.config.js. Use these when you need token values
// inside JavaScript (e.g., feeding colors to Recharts, which doesn't read
// Tailwind classes).

// ---------------------------------------------------------------------------
// Team color map — 2026 constructors
//
// Differentiation notes (teams that share a blue family):
//   redbull      #1E3A8A  — deep navy (HSL ~225°, L=34)
//   racingbulls  #818CF8  — periwinkle (HSL ~235°, L=72) — 38pt lighter
//   williams     #37BEDD  — sky/cyan  (HSL ~197°, L=55) — distinct hue
//
// The three blues are separated by both hue angle and lightness so they
// remain distinguishable in dark mode and under deuteranopia simulation.
// haas (#B6BABD) is near-neutral silver — differentiated from all blues
// by saturation (≈3% vs 60%+).
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
  | "racingbulls";

export const TEAM_COLORS: Record<TeamSlug, string> = {
  mercedes:    "#00D2BE",
  ferrari:     "#E8002D",
  redbull:     "#1E3A8A",
  mclaren:     "#FF8000",
  astonmartin: "#358C75",
  alpine:      "#0093CC",
  williams:    "#37BEDD",
  haas:        "#B6BABD",
  sauber:      "#52E252",
  racingbulls: "#818CF8",
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
