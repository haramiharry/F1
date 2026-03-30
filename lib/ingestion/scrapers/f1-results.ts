// Scraper for Formula1.com session results pages.
//
// URL pattern (confirmed for 2024/2025 seasons):
//   https://www.formula1.com/en/results/{year}/races/{round}/{circuit}/{session}
//
// NOTE: Formula1.com uses server-side rendered HTML for results archive pages,
// but the exact table structure may change between seasons. If parsing returns
// zero results, inspect the live page HTML and update extractTableRows /
// parseDriverRow accordingly before the next race weekend.
//
// Rate limit: minimum 2 s between requests to avoid hammering their CDN.

import { createHash } from "crypto";
import type {
  ScrapedSessionResults,
  ScrapedDriverResult,
  IngestableSessionType,
} from "@/lib/ingestion/types";
import type { TyreCompound } from "@/lib/db/types";

const RATE_LIMIT_MS = 2_000;
let lastRequestAt = 0;

// Maps our SessionType enum values to the URL path segment used by Formula1.com.
const SESSION_URL_SLUG: Record<IngestableSessionType, string> = {
  fp1: "practice-1",
  fp2: "practice-2",
  fp3: "practice-3",
  qualifying: "qualifying",
  sprint_qualifying: "sprint-qualifying",
  sprint: "sprint",
  race: "race-result",
};

export function buildResultsUrl(
  season: number,
  roundNumber: number,
  circuitSlug: string,
  sessionType: IngestableSessionType
): string {
  const slug = SESSION_URL_SLUG[sessionType];
  return `https://www.formula1.com/en/results/${season}/races/${roundNumber}/${circuitSlug}/${slug}`;
}

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const wait = RATE_LIMIT_MS - (now - lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();

  return fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; F1Intelligence/1.0; +https://f1intelligence.app)",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-GB,en;q=0.9",
    },
    signal: AbortSignal.timeout(15_000),
  });
}

// Strip HTML tags and normalise whitespace in a table cell value.
function cleanCell(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Extract <tbody> rows as arrays of cleaned cell strings.
// F1.com results tables are standard <table><tbody><tr><td> HTML.
function extractTableRows(html: string): string[][] {
  const rows: string[][] = [];
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return rows;

  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowPattern.exec(tbodyMatch[1])) !== null) {
    const cells: string[] = [];
    const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      cells.push(cleanCell(cellMatch[1]));
    }

    if (cells.length >= 4) rows.push(cells);
  }

  return rows;
}

// Parse a lap time string to milliseconds.
// Handles: "1:22.091" (race), "22.091" (sub-minute), "+0.456" (gap — caller strips "+").
// Returns null for non-time values: "DNF", "Retired", "DNS", "DSQ", "".
export function parseTimeToMs(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;

  // M:SS.mmm — e.g. "1:22.091"
  const full = s.match(/^(\d+):(\d{2})\.(\d{1,3})$/);
  if (full) {
    return (
      parseInt(full[1]) * 60_000 +
      parseInt(full[2]) * 1_000 +
      parseInt(full[3].padEnd(3, "0"))
    );
  }

  // SS.mmm — e.g. "58.456"
  const sub = s.match(/^(\d{1,2})\.(\d{1,3})$/);
  if (sub) {
    return parseInt(sub[1]) * 1_000 + parseInt(sub[2].padEnd(3, "0"));
  }

  return null;
}

const TYRE_MAP: Record<string, TyreCompound> = {
  S: "soft",
  SOFT: "soft",
  M: "medium",
  MEDIUM: "medium",
  H: "hard",
  HARD: "hard",
  I: "intermediate",
  INTER: "intermediate",
  INTERMEDIATE: "intermediate",
  W: "wet",
  WET: "wet",
};

function parseTyreCompound(raw: string): TyreCompound | null {
  return TYRE_MAP[raw.toUpperCase()] ?? null;
}

// F1.com results tables show the driver three-letter abbreviation as a
// standalone uppercase token in the driver name cell.
// e.g. "Max VERSTAPPEN VER" or separate cell containing just "VER".
function extractAbbreviation(cells: string[]): string | null {
  for (const cell of cells) {
    const m = cell.match(/\b([A-Z]{3})\b/);
    if (m) return m[1];
  }
  return null;
}

function parseDriverRow(cells: string[]): ScrapedDriverResult | null {
  const abbreviation = extractAbbreviation(cells);
  if (!abbreviation) return null;

  // Position is the first cell. Non-numeric = DNF/DSQ/DNS.
  const rawPos = cells[0] ?? "";
  const position = /^\d+$/.test(rawPos) ? parseInt(rawPos) : null;

  // Lap/best time: first parseable time found after the driver column (index 3+).
  let lapTimeMs: number | null = null;
  for (let i = 3; i < cells.length; i++) {
    lapTimeMs = parseTimeToMs(cells[i]);
    if (lapTimeMs !== null) break;
  }

  // Gap to leader: first cell starting with "+" that contains digits.
  let gapToLeaderMs: number | null = null;
  const gapCell = cells.find((c) => /^\+\d/.test(c));
  if (gapCell) {
    gapToLeaderMs = parseTimeToMs(gapCell.replace(/^\+\s*/, ""));
  }

  // Laps completed: first 2+ digit cell after position and car number columns.
  let lapsCompleted: number | null = null;
  for (let i = 2; i < cells.length; i++) {
    if (/^\d{2,}$/.test(cells[i])) {
      lapsCompleted = parseInt(cells[i]);
      break;
    }
  }

  // Tyre compound: single letter or known compound name in any cell.
  let tyreCompound: TyreCompound | null = null;
  for (const cell of cells) {
    const tc = parseTyreCompound(cell);
    if (tc) {
      tyreCompound = tc;
      break;
    }
  }

  return {
    driverAbbreviation: abbreviation,
    position,
    classified: position !== null,
    lapTimeMs,
    gapToLeaderMs,
    lapsCompleted,
    tyreCompound,
  };
}

// Fetch and parse session results from Formula1.com.
// Returns null if the page is unavailable or returns zero parseable rows
// (results not yet published).
export async function fetchSessionResults(
  url: string,
  meta: {
    season: number;
    roundNumber: number;
    sessionType: IngestableSessionType;
    circuitSlug: string;
  }
): Promise<ScrapedSessionResults | null> {
  let html: string;

  try {
    const resp = await rateLimitedFetch(url);
    if (!resp.ok) return null;
    html = await resp.text();
  } catch {
    return null;
  }

  const rawHtmlHash = createHash("md5").update(html, "utf8").digest("hex");
  const rows = extractTableRows(html);
  if (rows.length === 0) return null;

  const results = rows
    .map(parseDriverRow)
    .filter((r): r is ScrapedDriverResult => r !== null);

  if (results.length === 0) return null;

  return {
    sessionType: meta.sessionType,
    roundNumber: meta.roundNumber,
    season: meta.season,
    circuitSlug: meta.circuitSlug,
    results,
    sourceUrl: url,
    rawHtmlHash,
    accessedAt: new Date(),
  };
}
