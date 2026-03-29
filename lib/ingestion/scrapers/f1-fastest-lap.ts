// Scraper for the DHL Fastest Lap Award page on Formula1.com.
//
// URL pattern:
//   https://www.formula1.com/en/results/{year}/fastest-laps
//
// The page lists one fastest lap per round for the season with columns:
//   Round | Grand Prix | Driver | Car | Time | Avg Speed
//
// Rate limit: shared 2 s window with f1-results scraper via module-level state.

import { createHash } from "crypto";
import type { ScrapedFastestLap } from "@/lib/ingestion/types";
import { parseTimeToMs } from "@/lib/ingestion/scrapers/f1-results";

const RATE_LIMIT_MS = 2_000;
let lastRequestAt = 0;

export function buildFastestLapUrl(season: number): string {
  return `https://www.formula1.com/en/results/${season}/fastest-laps`;
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

function cleanCell(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

    if (cells.length >= 5) rows.push(cells);
  }

  return rows;
}

// Parse one fastest-lap table row.
// Expected columns: Round | Grand Prix | Driver | Car | Time | Avg Speed
function parseRow(
  cells: string[],
  season: number,
  sourceUrl: string,
  rawHtmlHash: string,
  accessedAt: Date
): ScrapedFastestLap | null {
  const roundNum = parseInt(cells[0] ?? "");
  if (isNaN(roundNum)) return null;

  // Driver abbreviation — three consecutive uppercase letters in any cell.
  let abbreviation: string | null = null;
  for (const cell of cells) {
    const m = cell.match(/\b([A-Z]{3})\b/);
    if (m) {
      abbreviation = m[1];
      break;
    }
  }
  if (!abbreviation) return null;

  // Lap time — first cell that parses as a valid time.
  let lapTimeMs: number | null = null;
  let lapTimeDisplay: string | null = null;
  for (const cell of cells) {
    const ms = parseTimeToMs(cell);
    if (ms !== null) {
      lapTimeMs = ms;
      lapTimeDisplay = cell.trim();
      break;
    }
  }
  if (lapTimeMs === null || lapTimeDisplay === null) return null;

  return {
    driverAbbreviation: abbreviation,
    roundNumber: roundNum,
    season,
    lapTimeMs,
    lapTimeDisplay,
    awardEligible: true, // Admin can override via direct DB edit if DQ'd
    sourceUrl,
    rawHtmlHash,
    accessedAt,
  };
}

// Fetch all fastest laps for a season from the DHL Fastest Lap Award page.
// Pass targetRound to filter to a single round (returns at most one element).
export async function fetchFastestLaps(
  season: number,
  targetRound?: number
): Promise<ScrapedFastestLap[]> {
  const url = buildFastestLapUrl(season);
  let html: string;

  try {
    const resp = await rateLimitedFetch(url);
    if (!resp.ok) return [];
    html = await resp.text();
  } catch {
    return [];
  }

  const rawHtmlHash = createHash("md5").update(html, "utf8").digest("hex");
  const rows = extractTableRows(html);
  const accessedAt = new Date();

  return rows
    .map((cells) => parseRow(cells, season, url, rawHtmlHash, accessedAt))
    .filter((r): r is ScrapedFastestLap => r !== null)
    .filter((r) => targetRound === undefined || r.roundNumber === targetRound);
}
