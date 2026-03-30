// Rules Explainer — standalone page, NOT in primary nav.
// Accessible via footer link and inline contextual popovers.
//
// Covers 2026-specific regulations that directly affect the intelligence
// platform's data and predictions. Each rule section links to its FIA
// source document.
//
// Contextual popovers on Car Detail, Track Intelligence, and Weekend Screen
// will deep-link to specific anchor IDs on this page via /rules#section-id.

import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, ChevronLeft } from "lucide-react";
import { SourceLabel } from "@/components/ui/source-label";

export const metadata: Metadata = {
  title: "2026 Rules Explainer",
  description: "How 2026 F1 technical regulations affect car performance data",
};

interface RuleSection {
  id: string;
  title: string;
  badge?: string;
  summary: string;
  detail: string;
  platformImpact: string;
  fiaRef?: string;
}

const RULES: RuleSection[] = [
  {
    id: "active-aero",
    title: "Active Aerodynamics (DAB System)",
    badge: "New for 2026",
    summary:
      "Cars feature a manually-controlled active aero system. Drivers activate drag-reduction (X-Mode) or downforce (Z-Mode) by pressing a button in designated DAB zones defined by the FIA per circuit.",
    detail:
      "The Drag Activation Button (DAB) system replaces DRS. Unlike DRS (rear-wing only, automatic zone activation), DAB simultaneously adjusts front and rear wing angles. X-Mode opens both wings for maximum straight-line speed. Z-Mode closes them for maximum downforce in high-speed corners. Drivers may only activate within FIA-defined DAB zones, published in the Event Notes approximately 48–72 hours before the first session.",
    platformImpact:
      "The platform derives X-Mode and Z-Mode effectiveness scores per car per circuit. These are withheld until DAB zone boundaries are confirmed by admin promotion. The aero_zone_value circuit profile dimension is new for 2026 and currently uses editorial estimates pending real-race calibration.",
    fiaRef: "FIA Technical Regulations 2026, Article 3.10",
  },
  {
    id: "power-unit",
    title: "Power Unit — 50% Electrical Power",
    badge: "New for 2026",
    summary:
      "The 2026 power unit produces approximately 50% of total power output from the electrical Motor Generator Unit (MGU). The internal combustion engine displaces 1.6L turbocharged.",
    detail:
      "The 2026 power unit retains the 1.6L V6 turbocharged ICE but introduces a significantly upgraded MGU-H and MGU-K. Total power output is approximately 1000bhp, with roughly half (≈500bhp) from the electrical system. This changes tyre degradation profiles, braking characteristics, and energy recovery zones compared to 2025.",
    platformImpact:
      "Power unit output affects long-run pace modelling. The greater electrical power fraction means chassis weight distribution and energy recovery circuit layouts influence long_run_pace more than in prior seasons. fp2 long-run pace uses the best-lap proxy (not stint telemetry) — see Methodology.",
    fiaRef: "FIA Power Unit Regulations 2026, Article 5.1",
  },
  {
    id: "weight",
    title: "Minimum Weight Reduction",
    badge: "New for 2026",
    summary:
      "The minimum car + driver weight decreases from 800kg (2025) to 768kg for 2026, enabling lighter car concepts.",
    detail:
      "The 22kg reduction opens design flexibility, particularly for suspension and ballast placement. Teams can redistribute weight more aggressively to optimise front/rear balance. Weight savings are unevenly distributed across constructors depending on their power unit package weight.",
    platformImpact:
      "The weight_kg field in Car specifications is non-nullable but many 2026 cars have not publicly confirmed their exact weight. Fields not publicly confirmed render as 'Not publicly confirmed' in the UI — no badge, no speculation.",
    fiaRef: "FIA Technical Regulations 2026, Article 4.1",
  },
  {
    id: "ground-effect",
    title: "Ground Effect Aerodynamics",
    summary:
      "All cars use ground effect aerodynamics as the primary downforce source. The floor generates more downforce than the wings, making floor design the primary competitive differentiator.",
    detail:
      "Ground effect was reintroduced in 2022. In 2026 the regulations tighten the floor geometry envelope to reduce performance differentials. The primary competitive battleground remains the diffuser and floor tunnels. High-downforce circuits (Monaco, Suzuka) benefit more from superior floor performance than from wing efficiency.",
    platformImpact:
      "Circuit profile dimensions (traction_demand, braking_intensity) correlate strongly with ground effect car performance. The track_fit score weights these dimensions accordingly. Drag_sensitivity remains relevant at DRS-replacement circuits with long straights.",
  },
  {
    id: "circuit-similarity",
    title: "Circuit Similarity Model",
    summary:
      "When a car has no 2026 data at a circuit, the platform infers predictions from similar circuits using a 5-dimensional Euclidean distance model.",
    detail:
      "The five circuit profile dimensions (drag_sensitivity, traction_demand, braking_intensity, overtaking_potential, aero_zone_value) define a position in circuit profile space. Circuits with similar profiles are expected to produce similar car performance orderings. The three closest circuits by Euclidean distance are used as proxies, weighted by similarity score.",
    platformImpact:
      "Similarity-inferred predictions carry LOW confidence and ±2.0s margin of error. aero_zone_value is a new 2026 dimension with no historical calibration, so its contribution to similarity scoring is equal-weighted but unvalidated. This is disclosed on the Methodology page.",
  },
];

function RuleCard({ rule }: { rule: RuleSection }) {
  return (
    <section id={rule.id} className="rounded-card bg-surface border border-border p-5 scroll-mt-20">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-data-medium font-semibold text-text-primary">
              {rule.title}
            </h2>
            {rule.badge && (
              <span className="text-caption border border-source-predicted/40 border-dashed text-source-predicted rounded-badge px-1.5 py-0.5 uppercase">
                {rule.badge}
              </span>
            )}
          </div>
          <p className="text-data-small text-text-secondary">{rule.summary}</p>
        </div>
      </div>

      <p className="text-caption text-text-secondary mb-3 leading-relaxed">
        {rule.detail}
      </p>

      <div className="rounded-badge bg-surface-elevated border border-border px-3 py-2 mb-3">
        <p className="text-caption text-text-muted uppercase tracking-wider mb-1">
          Platform impact
        </p>
        <p className="text-caption text-text-secondary leading-relaxed">
          {rule.platformImpact}
        </p>
      </div>

      {rule.fiaRef && (
        <p className="text-caption text-text-muted flex items-center gap-1">
          <ExternalLink size={10} aria-hidden />
          {rule.fiaRef}
        </p>
      )}
    </section>
  );
}

export default function RulesPage() {
  return (
    <div className="max-w-screen-md mx-auto px-4 py-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-caption text-text-muted hover:text-text-secondary transition-colors mb-4"
      >
        <ChevronLeft size={12} aria-hidden />
        Dashboard
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <SourceLabel variant="official" size="sm" />
          <span className="text-caption text-text-muted">FIA-sourced regulations</span>
        </div>
        <h1 className="text-data-hero font-bold text-text-primary">
          2026 Rules Explainer
        </h1>
        <p className="text-data-small text-text-secondary mt-1 max-w-lg">
          How the 2026 technical regulations affect car performance data,
          predictions, and the metrics shown on this platform.
        </p>
      </div>

      {/* Jump links */}
      <nav aria-label="Rule sections" className="flex flex-wrap gap-2 mb-6">
        {RULES.map((rule) => (
          <a
            key={rule.id}
            href={`#${rule.id}`}
            className="text-caption text-text-secondary border border-border rounded-badge px-2 py-1 hover:border-text-secondary hover:text-text-primary transition-colors"
          >
            {rule.title.split(" — ")[0].split("(")[0].trim()}
          </a>
        ))}
      </nav>

      <div className="space-y-4">
        {RULES.map((rule) => (
          <RuleCard key={rule.id} rule={rule} />
        ))}
      </div>

      <p className="text-caption text-text-muted text-center mt-8">
        Regulation interpretations are for informational purposes only.
        Always refer to the official FIA documents for binding regulatory text.
      </p>
    </div>
  );
}
