/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/ui/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // -----------------------------------------------------------------------
      // Design tokens — all mapped to CSS custom properties defined in
      // globals.css so dark/light switching happens without class rewriting.
      // -----------------------------------------------------------------------
      colors: {
        // Semantic surface tokens
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        "surface-elevated": "var(--color-surface-elevated)",
        border: "var(--color-border)",
        "border-subtle": "var(--color-border-subtle)",

        // Semantic text tokens
        "text-primary": "var(--color-text-primary)",
        "text-secondary": "var(--color-text-secondary)",
        "text-muted": "var(--color-text-muted)",

        // F1 brand accent
        f1: "#E10600",

        // Source label palette
        source: {
          official:  "#22C55E",
          derived:   "#38BDF8",
          predicted: "#F59E0B",
        },

        // Confidence palette
        confidence: {
          high:   "#22C55E",
          medium: "#F59E0B",
          low:    "#EF4444",
        },

        // -----------------------------------------------------------------------
        // Team color palette — 2026 constructors
        //
        // Differentiation: Red Bull (#1E3A8A navy) vs Racing Bulls (#818CF8
        // periwinkle) are separated by hue (~30° rotation) AND lightness
        // (L=25 vs L=65 in HSL). Williams (#37BEDD sky/cyan) sits at a
        // distinct hue from both. All three render unambiguously in dark mode
        // and remain distinguishable under deuteranopia simulation.
        // -----------------------------------------------------------------------
        team: {
          mercedes:    "#00D2BE",
          ferrari:     "#E8002D",
          redbull:     "#3671C6", // was #1E3A8A — too dark for dark-mode visibility
          mclaren:     "#FF8000",
          astonmartin: "#358C75",
          alpine:      "#0093CC",
          williams:    "#37BEDD",
          haas:        "#B6BABD",
          sauber:      "#52E252",
          racingbulls: "#818CF8",
        },
      },

      // -----------------------------------------------------------------------
      // Typography scale
      // data-hero   → lap times, headline numbers           32px bold
      // data-large  → section metrics                       24px semibold
      // data-medium → card metrics                          18px medium
      // data-small  → supporting stats                      14px regular
      // label       → column headers, badge text            12px medium
      // caption     → source attribution footnote           11px regular
      // -----------------------------------------------------------------------
      fontSize: {
        "data-hero":   ["2rem",     { lineHeight: "1",    fontWeight: "700" }],
        "data-large":  ["1.5rem",   { lineHeight: "1.2",  fontWeight: "600" }],
        "data-medium": ["1.125rem", { lineHeight: "1.4",  fontWeight: "500" }],
        "data-small":  ["0.875rem", { lineHeight: "1.5",  fontWeight: "400" }],
        label:         ["0.75rem",  { lineHeight: "1.4",  fontWeight: "500", letterSpacing: "0.06em" }],
        caption:       ["0.6875rem",{ lineHeight: "1.4",  fontWeight: "400" }],
      },

      borderRadius: {
        badge: "0.25rem",
        card:  "0.5rem",
      },

      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.15s ease-out",
      },
    },
  },
  plugins: [],
};
