// Methodology & Source Transparency — footer link, NOT in primary nav.
//
// Required disclosures from Step 7 review:
//   1. Circuit similarity uses equal dimension weights including uncalibrated aero_zone_value
//   2. DEFAULT_QUALI_RACE_DELTA = 1.018 is editorial prior from 2018-2024 data
//   3. fp2 long_run_pace is best-lap proxy, not stint telemetry
//
// Also covers:
//   - Source label definitions (Official / Derived / Predicted)
//   - Confidence tier definitions (Low / Medium / High)
//   - Amendment chain explanation
//   - Data staleness thresholds

import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SourceLabel } from "@/components/ui/source-label";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";

export const metadata: Metadata = {
  title: "Methodology & Sources",
  description: "How this platform computes predictions, assigns confidence, and cites data sources",
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-data-medium font-semibold text-text-primary mb-3 pb-2 border-b border-border">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Disclosure({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card bg-surface-elevated border border-source-predicted/30 border-dashed p-4">
      <p className="text-data-small font-semibold text-source-predicted mb-1.5">{title}</p>
      <div className="text-caption text-text-secondary leading-relaxed space-y-1.5">
        {children}
      </div>
    </div>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-caption text-text-secondary leading-relaxed">{children}</p>
  );
}

export default function MethodologyPage() {
  return (
    <div className="max-w-screen-md mx-auto px-4 py-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-caption text-text-muted hover:text-text-secondary transition-colors mb-4"
      >
        <ChevronLeft size={12} aria-hidden />
        Dashboard
      </Link>

      <div className="mb-8">
        <h1 className="text-data-hero font-bold text-text-primary">
          Methodology &amp; Sources
        </h1>
        <p className="text-data-small text-text-secondary mt-1 max-w-lg">
          How predictions are computed, how confidence is assigned, and what
          the data source labels mean. All known limitations are disclosed here.
        </p>
      </div>

      {/* Jump links */}
      <nav aria-label="Methodology sections" className="flex flex-wrap gap-2 mb-8">
        {[
          ["source-labels",    "Source labels"],
          ["confidence-tiers", "Confidence tiers"],
          ["fastest-lap",      "Fastest lap estimates"],
          ["circuit-similarity","Circuit similarity"],
          ["long-run-pace",    "Long-run pace"],
          ["quali-race-delta", "Q→Race delta"],
          ["amendment-chain",  "Amendment chain"],
          ["staleness",        "Data staleness"],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="text-caption text-text-secondary border border-border rounded-badge px-2 py-1 hover:border-text-secondary hover:text-text-primary transition-colors"
          >
            {label}
          </a>
        ))}
      </nav>

      <div className="space-y-10">

        {/* ── Source labels ── */}
        <Section id="source-labels" title="Source Labels">
          <Prose>
            Every metric on this platform carries one of three source labels.
            Each label has three independent non-color signals: border style,
            border weight, and icon character — so they remain distinguishable
            in greyscale and for users with colour vision deficiency.
          </Prose>
          <div className="space-y-3">
            {[
              {
                variant: "official" as const,
                title: "Official",
                description:
                  "Data sourced directly from Formula1.com results pages or FIA documents. Lap times, race results, fastest lap awards, and circuit regulations. Thick solid border + shield icon.",
              },
              {
                variant: "derived" as const,
                title: "Derived",
                description:
                  "Computed from official session data using documented formulae. Includes one-lap pace scores, long-run pace scores, straight-line efficiency, cornering performance, and track fit scores. Dotted border + sigma (σ) icon.",
              },
              {
                variant: "predicted" as const,
                title: "Predicted",
                description:
                  "Model or editorial estimates. Includes fastest lap time predictions, aero effectiveness predictions, and pre-season baselines. Dashed border + sparkles icon.",
              },
            ].map(({ variant, title, description }) => (
              <div key={variant} className="flex items-start gap-3 rounded-card bg-surface border border-border p-3">
                <SourceLabel variant={variant} size="md" />
                <div>
                  <p className="text-data-small font-medium text-text-primary">{title}</p>
                  <p className="text-caption text-text-secondary mt-0.5">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Confidence tiers ── */}
        <Section id="confidence-tiers" title="Confidence Tiers">
          <Prose>
            Confidence is assigned based on how much 2026 race data exists for
            the specific car + circuit combination. Icon shape varies by tier —
            not just color — so the tier is identifiable without relying on
            color vision.
          </Prose>
          <div className="space-y-3">
            {[
              {
                tier: "high" as const,
                label: "High",
                condition: "3 or more rounds of 2026 session data for this car + circuit.",
                marginOfError: "±0.3s",
              },
              {
                tier: "medium" as const,
                label: "Medium",
                condition: "1 or 2 rounds of 2026 session data, or circuit-similarity inference from 3+ similar circuits.",
                marginOfError: "±0.8s",
              },
              {
                tier: "low" as const,
                label: "Low",
                condition: "Pre-season only, no 2026 race data for this car + circuit combination, or similarity inference with limited comparable data.",
                marginOfError: "±2.0s",
              },
            ].map(({ tier, label, condition, marginOfError }) => (
              <div key={tier} className="flex items-start gap-3 rounded-card bg-surface border border-border p-3">
                <ConfidenceBadge tier={tier} size="lg" />
                <div>
                  <p className="text-data-small font-medium text-text-primary">{label}</p>
                  <p className="text-caption text-text-secondary mt-0.5">{condition}</p>
                  <p className="text-caption text-text-muted mt-0.5">
                    Fastest lap margin of error: {marginOfError}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Fastest lap estimates ── */}
        <Section id="fastest-lap" title="Fastest Lap Estimates">
          <Prose>
            Predicted fastest lap times are computed per car per circuit using
            the following formula:
          </Prose>
          <div className="rounded-card bg-surface-elevated border border-border px-4 py-3 font-mono text-caption text-text-secondary">
            estimatedMs = baselineMs × adjustmentFactor × qualiRaceDelta<br />
            adjustmentFactor = 1 − (carPace − fieldMean) × 0.005<br />
            qualiRaceDelta = observed ratio OR 1.018 default
          </div>
          <Prose>
            Where <strong className="text-text-primary">baselineMs</strong> is the circuit&apos;s
            editorial baseline fastest lap (pre-season estimate of expected race pace),{" "}
            <strong className="text-text-primary">carPace</strong> is the car&apos;s normalised
            one-lap pace score (0–10), and{" "}
            <strong className="text-text-primary">fieldMean</strong> is the mean one-lap pace
            across all cars at this circuit. PACE_UNIT_PCT = 0.005 means each pace unit above
            the field mean corresponds to a 0.5% lap time reduction.
          </Prose>
        </Section>

        {/* ── Required disclosures ── */}
        <Section id="circuit-similarity" title="Circuit Similarity Model">
          <Prose>
            When a car has no 2026 data at a circuit, predictions are inferred
            from the three most similar circuits by 5D Euclidean profile distance.
          </Prose>
          <Disclosure title="Disclosure: equal dimension weighting (unvalidated)">
            <p>
              The five circuit profile dimensions are weighted equally (1.0 each) in the
              Euclidean distance calculation. This is an unvalidated assumption.
            </p>
            <p>
              <strong className="text-text-primary">aero_zone_value</strong> is a new 2026 dimension
              with no historical anchor — its 0–10 scale was defined editorially for this platform.
              Treating it with equal weight to <strong className="text-text-primary">drag_sensitivity</strong> and{" "}
              <strong className="text-text-primary">braking_intensity</strong> (which have years of F1
              circuit characterisation behind them) may over-emphasise an uncalibrated dimension.
            </p>
            <p>
              Recalibration is planned after Round 6+ of 2026 data. Until then, all
              similarity-inferred predictions carry LOW confidence and ±2.0s margin of error.
            </p>
          </Disclosure>
        </Section>

        <Section id="long-run-pace" title="Long-Run Pace">
          <Prose>
            Long-run pace is only recorded for FP2 and race sessions. It is intentionally
            null for FP1, FP3, qualifying, sprint qualifying, and sprint sessions.
          </Prose>
          <Disclosure title="Disclosure: FP2 long-run pace is a best-lap proxy">
            <p>
              For FP2 sessions, <strong className="text-text-primary">long_run_pace</strong> is
              computed as the car&apos;s best recorded lap time relative to the field — it is NOT
              derived from stint telemetry or tyre degradation analysis.
            </p>
            <p>
              True long-run pace (stint-average pace accounting for fuel load, compound choice,
              and degradation rate) requires data not publicly available from Formula1.com.
              The best-lap proxy provides a directional signal but may not reflect race-pace
              ordering accurately, particularly for high-deg circuits.
            </p>
          </Disclosure>
        </Section>

        <Section id="quali-race-delta" title="Qualifying-to-Race Pace Delta">
          <Disclosure title="Disclosure: DEFAULT_QUALI_RACE_DELTA = 1.018 is an editorial constant">
            <p>
              When no 2026 qualifying + race fastest-lap pair is available for a circuit,
              the platform uses a default delta of <strong className="text-text-primary">1.018</strong>.
            </p>
            <p>
              This value is derived from editorial analysis of 2018–2024 dry-weather F1 race
              results. The mean ratio of (race fastest lap / qualifying pole lap) across those
              seasons was approximately 1.015–1.020 per circuit. 1.018 is the midpoint estimate.
            </p>
            <p>
              This is an editorial constant, not a calibrated model output. Its uncertainty
              is absorbed into the prediction&apos;s margin of error. It will be superseded
              circuit-by-circuit as 2026 qualifying and race data accumulates.
            </p>
          </Disclosure>
        </Section>

        {/* ── Amendment chain ── */}
        <Section id="amendment-chain" title="Amendment Chain">
          <Prose>
            When official data is revised (e.g. a post-race penalty changes a lap time),
            the platform never overwrites the original record. Instead:
          </Prose>
          <ol className="space-y-1.5 list-none">
            {[
              "A new record is created with the updated data.",
              "The original record is marked superseded_at and linked to the new record via superseded_by_id.",
              "The amendment_reason field records why the change was made.",
              "All superseded records are permanently retained for audit purposes.",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-caption text-text-secondary">
                <span className="text-text-muted font-mono shrink-0 mt-0.5">{i + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
          <Prose>
            The amendment history panel (accessible via the clock icon on any data point) shows
            the full chain, most recent first, for fastest laps, predictions, car performance
            records, and DAB zones.
          </Prose>
        </Section>

        {/* ── Staleness ── */}
        <Section id="staleness" title="Data Staleness Thresholds">
          <Prose>
            Source provenance records track when data was last verified. Stale
            data is flagged for admin review but remains visible — it is not
            removed.
          </Prose>
          <div className="rounded-card bg-surface border border-border overflow-hidden">
            <table className="w-full text-caption">
              <thead>
                <tr className="border-b border-border bg-surface-elevated">
                  <th className="text-left px-3 py-2 text-text-muted uppercase tracking-wider">Session type</th>
                  <th className="text-right px-3 py-2 text-text-muted uppercase tracking-wider">Stale after</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Race / round aggregate", "24 hours"],
                  ["Qualifying / sprint qualifying / sprint", "12 hours"],
                  ["FP1 / FP2 / FP3", "6 hours"],
                  ["FIA documents", "7 days"],
                ].map(([type, threshold]) => (
                  <tr key={type} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-text-secondary">{type}</td>
                    <td className="px-3 py-2 text-text-secondary text-right font-mono">{threshold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

      </div>

      <p className="text-caption text-text-muted text-center mt-10">
        Last updated: March 2026. Methodology is updated as the season progresses.{" "}
        <Link href="/rules" className="underline hover:text-text-secondary transition-colors">
          2026 Rules Explainer →
        </Link>
      </p>
    </div>
  );
}
