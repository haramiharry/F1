"use client";

// AmendmentPanel — slide-in panel showing the amendment chain for any entity.
//
// Activated by the URL param:  ?amendmentHistory=entityType:entityId
//   e.g. ?amendmentHistory=fastest_laps:cld_abc123
//        ?amendmentHistory=predictions:cld_xyz789
//        ?amendmentHistory=car_circuit_performance:cld_def456
//
// Supported entity types (matches @@map names in schema.prisma):
//   fastest_laps, predictions, car_circuit_performance, circuit_dab_zones
//
// Dismiss: clicking the overlay or the × button removes the param via
// router.push (preserving all other params).
//
// Step 8: renders with placeholder amendment data. Step 9 will wire the
// real API call to /api/amendments/[entityType]/[entityId].

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X, GitCommit, Clock } from "lucide-react";
import { SourceLabel } from "@/components/ui/source-label";

const ENTITY_LABELS: Record<string, string> = {
  fastest_laps:             "Fastest Lap",
  predictions:              "Prediction",
  car_circuit_performance:  "Car Circuit Performance",
  circuit_dab_zones:        "DAB Zone",
};

// Placeholder amendment record shape (matches the superseded_at chain pattern).
interface AmendmentRecord {
  id: string;
  createdAt: string;
  amendmentReason: string | null;
  sourceType: "official" | "derived" | "predicted";
  isCurrent: boolean;
  summary: string;
}

// Placeholder data — replaced by real API in Step 9.
const PLACEHOLDER_CHAIN: AmendmentRecord[] = [
  {
    id: "cld_current_001",
    createdAt: "2026-03-16T14:22:00Z",
    amendmentReason: "Post-race penalty applied — lap time revised",
    sourceType: "official",
    isCurrent: true,
    summary: "1:22.091 — VER — Round 1 Australia",
  },
  {
    id: "cld_superseded_001",
    createdAt: "2026-03-16T12:05:00Z",
    amendmentReason: null,
    sourceType: "official",
    isCurrent: false,
    summary: "1:21.889 — VER — Round 1 Australia (superseded)",
  },
];

export function AmendmentPanel() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const param = searchParams.get("amendmentHistory");
  if (!param) return null;

  const [entityType, entityId] = param.split(":");
  if (!entityType || !entityId) return null;

  const label = ENTITY_LABELS[entityType] ?? entityType;

  function dismiss() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("amendmentHistory");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        aria-hidden
        onClick={dismiss}
      />

      {/* Panel */}
      <aside
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-surface border-l border-border flex flex-col shadow-2xl animate-fade-in"
        role="complementary"
        aria-label="Amendment history"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <GitCommit size={14} className="text-text-muted shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="text-label uppercase text-text-secondary tracking-wider">
                Amendment History
              </p>
              <p className="text-caption text-text-muted truncate">
                {label} · {entityId.slice(0, 12)}…
              </p>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="rounded-badge p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors shrink-0"
            aria-label="Close amendment history"
          >
            <X size={16} />
          </button>
        </div>

        {/* Chain */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <p className="text-caption text-text-muted">
            Most recent first. The current active record is highlighted.
          </p>

          {PLACEHOLDER_CHAIN.map((record, idx) => (
            <div
              key={record.id}
              className={[
                "rounded-card border p-3",
                record.isCurrent
                  ? "bg-surface-elevated border-border"
                  : "bg-surface border-border opacity-60",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-caption text-text-muted font-mono">
                  #{idx + 1}
                </span>
                {record.isCurrent ? (
                  <span className="text-caption text-confidence-high border border-confidence-high/30 rounded-badge px-1.5 py-0.5 uppercase">
                    Current
                  </span>
                ) : (
                  <span className="text-caption text-text-muted border border-border rounded-badge px-1.5 py-0.5 uppercase">
                    Superseded
                  </span>
                )}
              </div>

              <p className="text-data-small text-text-primary mb-2">
                {record.summary}
              </p>

              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                <SourceLabel variant={record.sourceType} size="sm" />
              </div>

              <div className="flex items-center gap-1 text-caption text-text-muted">
                <Clock size={10} aria-hidden />
                {new Date(record.createdAt).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>

              {record.amendmentReason && (
                <p className="text-caption text-text-secondary mt-1.5 border-t border-border pt-1.5">
                  {record.amendmentReason}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="px-4 py-3 border-t border-border shrink-0">
          <p className="text-caption text-text-muted">
            Amendment chains are permanent. Superseded records are retained
            for audit purposes and never deleted.
          </p>
        </div>
      </aside>
    </>
  );
}
