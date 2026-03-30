"use client";

// AmendmentPanel — slide-in panel showing the amendment chain for any entity.
//
// Activated by: ?amendmentHistory=entityType:entityId
//   e.g. ?amendmentHistory=predictions:cld_abc123
//        ?amendmentHistory=circuit_dab_zones:cld_xyz789
//
// Supported entity types (@@map names in schema.prisma):
//   fastest_laps | predictions | car_circuit_performance | circuit_dab_zones
//
// Data: fetches /api/amendments?entityType=X&entityId=Y when param is present.
// Loading state: skeleton rows.
// Error state: inline error message.
// Empty state: "No amendment history found."
//
// Dismiss: backdrop click or × button removes the param via router.push.

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X, GitCommit, Clock, AlertCircle } from "lucide-react";
import { SourceLabel } from "@/components/ui/source-label";
import type { AmendmentsApiResponse, AmendmentEntry } from "@/lib/api/types";

const ENTITY_LABELS: Record<string, string> = {
  fastest_laps:            "Fastest Lap",
  predictions:             "Prediction",
  car_circuit_performance: "Car Performance",
  circuit_dab_zones:       "DAB Zone",
};

function AmendmentSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-card border border-border p-3 space-y-2">
          <div className="flex justify-between">
            <div className="h-3 w-8 bg-surface-elevated rounded" />
            <div className="h-3 w-16 bg-surface-elevated rounded" />
          </div>
          <div className="h-4 w-48 bg-surface-elevated rounded" />
          <div className="h-3 w-24 bg-surface-elevated rounded" />
        </div>
      ))}
    </div>
  );
}

function AmendmentCard({ record, index }: { record: AmendmentEntry; index: number }) {
  const sourceVariant =
    record.sourceType === "official" || record.sourceType === "derived" || record.sourceType === "predicted"
      ? (record.sourceType as "official" | "derived" | "predicted")
      : "derived";

  return (
    <div
      className={[
        "rounded-card border p-3",
        record.isCurrent
          ? "bg-surface-elevated border-border"
          : "bg-surface border-border opacity-60",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-caption text-text-muted font-mono">#{index + 1}</span>
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

      <p className="text-data-small text-text-primary mb-2">{record.summary}</p>

      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <SourceLabel variant={sourceVariant} size="sm" />
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
  );
}

export function AmendmentPanel() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const param = searchParams.get("amendmentHistory");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amendments, setAmendments] = useState<AmendmentEntry[]>([]);
  const [lastParam, setLastParam] = useState<string | null>(null);

  // Parse entity type and ID from param.
  const parsed = param ? param.split(":") : null;
  const entityType = parsed?.[0] ?? null;
  const entityId = parsed?.[1] ?? null;
  const label = entityType ? (ENTITY_LABELS[entityType] ?? entityType) : null;

  // Fetch when the param changes.
  useEffect(() => {
    if (!param || !entityType || !entityId) return;
    if (param === lastParam) return; // already fetched for this param

    setLoading(true);
    setError(null);
    setLastParam(param);

    fetch(`/api/amendments?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: AmendmentsApiResponse = await res.json();
        setAmendments(json.amendments);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Unknown error");
      })
      .finally(() => setLoading(false));
  }, [param, entityType, entityId, lastParam]);

  // Not shown when param is absent.
  if (!param || !entityType || !entityId || !label) return null;

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

          {loading && <AmendmentSkeleton />}

          {error && (
            <div className="flex items-start gap-2 rounded-badge border border-confidence-low/30 p-3">
              <AlertCircle size={14} className="text-confidence-low shrink-0 mt-0.5" aria-hidden />
              <p className="text-caption text-text-secondary">
                Failed to load amendment history: {error}
              </p>
            </div>
          )}

          {!loading && !error && amendments.length === 0 && (
            <p className="text-caption text-text-muted text-center py-4">
              No amendment history found for this record.
            </p>
          )}

          {!loading &&
            !error &&
            amendments.map((record, idx) => (
              <AmendmentCard key={record.id} record={record} index={idx} />
            ))}
        </div>

        {/* Footer */}
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
