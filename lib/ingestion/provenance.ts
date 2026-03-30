import { createHash } from "crypto";
import { prisma } from "@/lib/db/client";
import type { SourceType } from "@/lib/db/types";

export function hashContent(content: string): string {
  return createHash("md5").update(content, "utf8").digest("hex");
}

export interface CreateProvenanceOptions {
  sourceType: SourceType;
  url?: string;
  documentReference?: string;
  content?: string;       // raw content to hash — ignored if contentHash provided
  contentHash?: string;   // pre-computed MD5 (takes priority over content)
  staleThresholdHours: number;
}

// Creates a source_provenance record and returns its id.
// Called before every write that needs a provenance FK.
// The record is permanent (never deleted) — intentionally created outside any
// surrounding transaction so an orphaned provenance on rollback is acceptable.
export async function createProvenance(
  opts: CreateProvenanceOptions
): Promise<string> {
  const hash =
    opts.contentHash ?? (opts.content ? hashContent(opts.content) : undefined);

  const record = await prisma.sourceProvenance.create({
    data: {
      source_type: opts.sourceType,
      url: opts.url ?? null,
      document_reference: opts.documentReference ?? null,
      accessed_at: new Date(),
      content_hash: hash ?? null,
      stale_threshold_hours: opts.staleThresholdHours,
    },
    select: { id: true },
  });

  return record.id;
}
