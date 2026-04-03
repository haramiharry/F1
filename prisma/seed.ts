// Prisma seed — full 2026 F1 grid.
//
// Seeds all 11 teams, 22 drivers, 22 circuits + profiles, 22 rounds,
// race sessions + results for completed rounds, and 242 editorial baseline
// fastest-lap predictions (11 cars × 22 circuits).
//
// Idempotent: uses upsert everywhere a unique key exists; findFirst + conditional
// create for tables without model-level unique constraints (SourceProvenance, Car,
// Session, FastestLap). Editorial predictions are deleted and recreated on each run.
//
// Run via:
//   npx prisma db seed
//
// Prerequisites:
//   npx prisma migrate deploy
//   npx tsx prisma/apply-indexes.ts

import { PrismaClient, SourceType } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findOrCreateProvenance(
  url: string,
  sourceType: SourceType,
  accessedAt: Date,
  staleThresholdHours: number,
) {
  const existing = await prisma.sourceProvenance.findFirst({
    where: { url, source_type: sourceType },
  });
  if (existing) return existing;
  return prisma.sourceProvenance.create({
    data: {
      source_type: sourceType,
      url,
      accessed_at: accessedAt,
      stale_threshold_hours: staleThresholdHours,
    },
  });
}

async function findOrCreateCar(
  teamId: string,
  season: number,
  designation: string,
  specsProvenanceId: string,
) {
  const existing = await prisma.car.findFirst({ where: { team_id: teamId, season } });
  if (existing) return existing;
  return prisma.car.create({
    data: { team_id: teamId, season, designation, specs_provenance_id: specsProvenanceId },
  });
}

async function findOrCreateSession(
  roundId: string,
  sessionType: "race",
  scheduledStart: Date,
  actualStart: Date,
  endedAt: Date,
) {
  const existing = await prisma.session.findFirst({
    where: { round_id: roundId, session_type: sessionType },
  });
  if (existing) return existing;
  return prisma.session.create({
    data: {
      round_id: roundId,
      session_type: sessionType,
      scheduled_start: scheduledStart,
      actual_start: actualStart,
      ended_at: endedAt,
    },
  });
}

function msToDisplay(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${m}:${String(s).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// Data tables
// ---------------------------------------------------------------------------

const TEAM_DATA = [
  { slug: "redbull",     name: "Oracle Red Bull Racing",            short_name: "Red Bull",      power_unit: "Honda RBPT",  color: "#3671C6", car: "RB26"   },
  { slug: "ferrari",     name: "Scuderia Ferrari HP",               short_name: "Ferrari",       power_unit: "Ferrari",     color: "#E8002D", car: "SF-26"  },
  { slug: "mercedes",    name: "Mercedes-AMG PETRONAS F1 Team",     short_name: "Mercedes",      power_unit: "Mercedes",    color: "#00D2BE", car: "W17"    },
  { slug: "mclaren",     name: "McLaren F1 Team",                   short_name: "McLaren",       power_unit: "Mercedes",    color: "#FF8000", car: "MCL40"  },
  { slug: "astonmartin", name: "Aston Martin Aramco F1 Team",       short_name: "Aston Martin",  power_unit: "Honda RBPT",  color: "#358C75", car: "AMR26"  },
  { slug: "alpine",      name: "BWT Alpine F1 Team",                short_name: "Alpine",        power_unit: "Renault",     color: "#0093CC", car: "A526"   },
  { slug: "williams",    name: "Williams Racing",                   short_name: "Williams",      power_unit: "Mercedes",    color: "#37BEDD", car: "FW48"   },
  { slug: "haas",        name: "MoneyGram Haas F1 Team",            short_name: "Haas",          power_unit: "Ferrari",     color: "#B6BABD", car: "VF-26"  },
  { slug: "sauber",      name: "Audi F1 Team",                     short_name: "Audi",          power_unit: "Audi",        color: "#52E252", car: "C46"    },
  { slug: "racingbulls", name: "Visa Cash App Racing Bulls F1 Team",short_name: "Racing Bulls",  power_unit: "Honda RBPT",  color: "#818CF8", car: "RB01"   },
  { slug: "cadillac",    name: "Cadillac F1 Team",                  short_name: "Cadillac",      power_unit: "GM / Ferrari",color: "#C8A951", car: "TWO-26" },
] as const;

const DRIVER_DATA = [
  // Red Bull
  { abbr: "VER", first: "Max",      last: "Verstappen", number: 3,  nationality: "Dutch",      teamSlug: "redbull"     },
  { abbr: "HAD", first: "Isack",    last: "Hadjar",     number: 6,  nationality: "French",     teamSlug: "redbull"     },
  // Ferrari
  { abbr: "LEC", first: "Charles",  last: "Leclerc",    number: 16, nationality: "Monégasque", teamSlug: "ferrari"     },
  { abbr: "HAM", first: "Lewis",    last: "Hamilton",   number: 44, nationality: "British",    teamSlug: "ferrari"     },
  // Mercedes
  { abbr: "RUS", first: "George",   last: "Russell",    number: 63, nationality: "British",    teamSlug: "mercedes"    },
  { abbr: "ANT", first: "Kimi",     last: "Antonelli",  number: 12, nationality: "Italian",    teamSlug: "mercedes"    },
  // McLaren
  { abbr: "NOR", first: "Lando",    last: "Norris",     number: 1,  nationality: "British",    teamSlug: "mclaren"     },
  { abbr: "PIA", first: "Oscar",    last: "Piastri",    number: 81, nationality: "Australian", teamSlug: "mclaren"     },
  // Aston Martin
  { abbr: "ALO", first: "Fernando", last: "Alonso",     number: 14, nationality: "Spanish",    teamSlug: "astonmartin" },
  { abbr: "STR", first: "Lance",    last: "Stroll",     number: 18, nationality: "Canadian",   teamSlug: "astonmartin" },
  // Alpine
  { abbr: "GAS", first: "Pierre",   last: "Gasly",      number: 10, nationality: "French",     teamSlug: "alpine"      },
  { abbr: "COL", first: "Franco",   last: "Colapinto",  number: 43, nationality: "Argentine",  teamSlug: "alpine"      },
  // Williams
  { abbr: "SAI", first: "Carlos",   last: "Sainz",      number: 55, nationality: "Spanish",    teamSlug: "williams"    },
  { abbr: "ALB", first: "Alexander",last: "Albon",      number: 23, nationality: "Thai",       teamSlug: "williams"    },
  // Haas
  { abbr: "OCO", first: "Esteban",  last: "Ocon",       number: 31, nationality: "French",     teamSlug: "haas"        },
  { abbr: "BEA", first: "Oliver",   last: "Bearman",    number: 87, nationality: "British",    teamSlug: "haas"        },
  // Sauber / Audi
  { abbr: "HUL", first: "Nico",     last: "Hülkenberg", number: 27, nationality: "German",     teamSlug: "sauber"      },
  { abbr: "BOR", first: "Gabriel",  last: "Bortoleto",  number: 5,  nationality: "Brazilian",  teamSlug: "sauber"      },
  // Racing Bulls
  { abbr: "LAW", first: "Liam",     last: "Lawson",     number: 30, nationality: "New Zealander", teamSlug: "racingbulls" },
  { abbr: "LIN", first: "Arvid",    last: "Lindblad",   number: 41, nationality: "Swedish",    teamSlug: "racingbulls" },
  // Cadillac
  { abbr: "PER", first: "Sergio",   last: "Pérez",      number: 11, nationality: "Mexican",    teamSlug: "cadillac"    },
  { abbr: "BOT", first: "Valtteri", last: "Bottas",     number: 77, nationality: "Finnish",    teamSlug: "cadillac"    },
];

const CIRCUIT_DATA = [
  {
    slug: "albert-park",     name: "Albert Park Circuit",              short: "Albert Park",    country: "Australia",  city: "Melbourne",      km: 5.278, laps: 58,
    drag: 0.55, traction: 0.65, braking: 0.60, overtaking: 0.55, aero: 0.55, baseline: 82.1,  threshold: 3.0,
    race: new Date("2026-03-08T05:00:00Z"), raceEnd: new Date("2026-03-08T07:05:00Z"),
  },
  {
    slug: "shanghai",        name: "Shanghai International Circuit",   short: "Shanghai",       country: "China",      city: "Shanghai",       km: 5.451, laps: 56,
    drag: 0.60, traction: 0.70, braking: 0.65, overtaking: 0.70, aero: 0.65, baseline: 95.3,  threshold: 3.0,
    race: new Date("2026-03-15T07:00:00Z"), raceEnd: new Date("2026-03-15T09:10:00Z"),
  },
  {
    slug: "suzuka",          name: "Suzuka International Racing Course",short: "Suzuka",         country: "Japan",      city: "Suzuka",         km: 5.807, laps: 53,
    drag: 0.65, traction: 0.60, braking: 0.70, overtaking: 0.35, aero: 0.60, baseline: 91.0,  threshold: 3.0,
    race: new Date("2026-03-29T05:00:00Z"), raceEnd: null,
  },
  {
    slug: "miami",           name: "Miami International Autodrome",    short: "Miami",          country: "USA",        city: "Miami",          km: 5.412, laps: 57,
    drag: 0.50, traction: 0.60, braking: 0.65, overtaking: 0.60, aero: 0.55, baseline: 89.5,  threshold: 3.0,
    race: new Date("2026-05-03T19:00:00Z"), raceEnd: null,
  },
  {
    slug: "villeneuve",      name: "Circuit Gilles Villeneuve",        short: "Montréal",       country: "Canada",     city: "Montréal",       km: 4.361, laps: 70,
    drag: 0.45, traction: 0.55, braking: 0.85, overtaking: 0.70, aero: 0.50, baseline: 74.0,  threshold: 3.0,
    race: new Date("2026-05-24T18:00:00Z"), raceEnd: null,
  },
  {
    slug: "monaco",          name: "Circuit de Monaco",                short: "Monaco",         country: "Monaco",     city: "Monte Carlo",    km: 3.337, laps: 78,
    drag: 0.20, traction: 0.90, braking: 0.75, overtaking: 0.10, aero: 0.15, baseline: 73.0,  threshold: 3.0,
    race: new Date("2026-06-07T13:00:00Z"), raceEnd: null,
  },
  {
    slug: "barcelona-catalunya", name: "Circuit de Barcelona-Catalunya", short: "Barcelona",   country: "Spain",      city: "Barcelona",      km: 4.657, laps: 66,
    drag: 0.75, traction: 0.65, braking: 0.55, overtaking: 0.45, aero: 0.70, baseline: 79.0,  threshold: 3.0,
    race: new Date("2026-06-14T13:00:00Z"), raceEnd: null,
  },
  {
    slug: "red-bull-ring",   name: "Red Bull Ring",                    short: "Spielberg",      country: "Austria",    city: "Spielberg",      km: 4.318, laps: 71,
    drag: 0.60, traction: 0.65, braking: 0.80, overtaking: 0.65, aero: 0.55, baseline: 65.5,  threshold: 2.5,
    race: new Date("2026-06-28T13:00:00Z"), raceEnd: null,
  },
  {
    slug: "silverstone",     name: "Silverstone Circuit",              short: "Silverstone",    country: "UK",         city: "Silverstone",    km: 5.891, laps: 52,
    drag: 0.80, traction: 0.50, braking: 0.50, overtaking: 0.55, aero: 0.75, baseline: 87.0,  threshold: 3.0,
    race: new Date("2026-07-05T14:00:00Z"), raceEnd: null,
  },
  {
    slug: "spa",             name: "Circuit de Spa-Francorchamps",     short: "Spa",            country: "Belgium",    city: "Stavelot",       km: 7.004, laps: 44,
    drag: 0.55, traction: 0.55, braking: 0.65, overtaking: 0.75, aero: 0.65, baseline: 104.0, threshold: 3.5,
    race: new Date("2026-07-19T13:00:00Z"), raceEnd: null,
  },
  {
    slug: "hungaroring",     name: "Hungaroring",                      short: "Budapest",       country: "Hungary",    city: "Budapest",       km: 4.381, laps: 70,
    drag: 0.80, traction: 0.80, braking: 0.55, overtaking: 0.30, aero: 0.75, baseline: 78.0,  threshold: 3.0,
    race: new Date("2026-07-26T13:00:00Z"), raceEnd: null,
  },
  {
    slug: "zandvoort",       name: "Circuit Zandvoort",                short: "Zandvoort",      country: "Netherlands",city: "Zandvoort",      km: 4.259, laps: 72,
    drag: 0.70, traction: 0.65, braking: 0.60, overtaking: 0.35, aero: 0.65, baseline: 71.0,  threshold: 3.0,
    race: new Date("2026-08-23T13:00:00Z"), raceEnd: null,
  },
  {
    slug: "monza",           name: "Autodromo Nazionale di Monza",     short: "Monza",          country: "Italy",      city: "Monza",          km: 5.793, laps: 53,
    drag: 0.15, traction: 0.35, braking: 0.90, overtaking: 0.75, aero: 0.10, baseline: 81.0,  threshold: 3.0,
    race: new Date("2026-09-06T13:00:00Z"), raceEnd: null,
  },
  {
    slug: "madrid-madring",  name: "Circuito de Madrid Jarama-RACE",   short: "Madrid",         country: "Spain",      city: "Madrid",         km: 5.050, laps: 60,
    drag: 0.55, traction: 0.75, braking: 0.75, overtaking: 0.45, aero: 0.55, baseline: 85.0,  threshold: 4.0,
    race: new Date("2026-09-13T13:00:00Z"), raceEnd: null,
  },
  {
    slug: "baku",            name: "Baku City Circuit",                short: "Baku",           country: "Azerbaijan", city: "Baku",           km: 6.003, laps: 51,
    drag: 0.20, traction: 0.55, braking: 0.90, overtaking: 0.80, aero: 0.25, baseline: 100.0, threshold: 3.0,
    race: new Date("2026-09-27T11:00:00Z"), raceEnd: null,
  },
  {
    slug: "marina-bay",      name: "Marina Bay Street Circuit",        short: "Singapore",      country: "Singapore",  city: "Singapore",      km: 4.940, laps: 61,
    drag: 0.65, traction: 0.85, braking: 0.80, overtaking: 0.30, aero: 0.65, baseline: 97.0,  threshold: 3.0,
    race: new Date("2026-10-11T12:00:00Z"), raceEnd: null,
  },
  {
    slug: "cota",            name: "Circuit of the Americas",          short: "Austin",         country: "USA",        city: "Austin",         km: 5.513, laps: 56,
    drag: 0.65, traction: 0.60, braking: 0.65, overtaking: 0.60, aero: 0.60, baseline: 96.0,  threshold: 3.0,
    race: new Date("2026-10-25T19:00:00Z"), raceEnd: null,
  },
  {
    slug: "hermanos-rodriguez", name: "Autodromo Hermanos Rodríguez",  short: "Mexico City",    country: "Mexico",     city: "Mexico City",    km: 4.304, laps: 71,
    drag: 0.45, traction: 0.55, braking: 0.70, overtaking: 0.55, aero: 0.40, baseline: 79.0,  threshold: 3.0,
    race: new Date("2026-11-01T20:00:00Z"), raceEnd: null,
  },
  {
    slug: "interlagos",      name: "Autodromo José Carlos Pace",       short: "São Paulo",      country: "Brazil",     city: "São Paulo",      km: 4.309, laps: 71,
    drag: 0.60, traction: 0.65, braking: 0.70, overtaking: 0.70, aero: 0.60, baseline: 71.0,  threshold: 3.0,
    race: new Date("2026-11-08T17:00:00Z"), raceEnd: null,
  },
  {
    slug: "las-vegas",       name: "Las Vegas Strip Circuit",          short: "Las Vegas",      country: "USA",        city: "Las Vegas",      km: 6.201, laps: 50,
    drag: 0.20, traction: 0.55, braking: 0.80, overtaking: 0.75, aero: 0.25, baseline: 93.0,  threshold: 3.0,
    race: new Date("2026-11-21T06:00:00Z"), raceEnd: null,
  },
  {
    slug: "lusail",          name: "Lusail International Circuit",     short: "Lusail",         country: "Qatar",      city: "Lusail",         km: 5.380, laps: 57,
    drag: 0.65, traction: 0.75, braking: 0.65, overtaking: 0.40, aero: 0.65, baseline: 83.0,  threshold: 3.0,
    race: new Date("2026-11-29T15:00:00Z"), raceEnd: null,
  },
  {
    slug: "yas-marina",      name: "Yas Marina Circuit",               short: "Abu Dhabi",      country: "UAE",        city: "Abu Dhabi",      km: 5.281, laps: 58,
    drag: 0.55, traction: 0.60, braking: 0.60, overtaking: 0.55, aero: 0.55, baseline: 87.0,  threshold: 3.0,
    race: new Date("2026-12-06T13:00:00Z"), raceEnd: null,
  },
];

// Pre-season editorial performance tier offset (ms above circuit baseline).
// Represents expected qualifying/fastest-lap delta versus theoretical minimum.
const TEAM_OFFSET_MS: Record<string, number> = {
  mclaren:     200,
  ferrari:     250,
  redbull:     300,
  mercedes:    350,
  astonmartin: 700,
  williams:    750,
  alpine:      800,
  racingbulls: 900,
  sauber:      950,
  haas:       1000,
  cadillac:   1200,
};

// Round 1 and 2 completed anchor data
const COMPLETED_ROUNDS = [
  {
    roundNumber: 1,
    circuitSlug: "albert-park",
    gpName: "Australian Grand Prix",
    scheduledStart: new Date("2026-03-08T05:00:00Z"),
    actualStart:    new Date("2026-03-08T05:00:00Z"),
    endedAt:        new Date("2026-03-08T07:05:00Z"),
    fastestLapDriverAbbr: "VER",
    fastestLapMs: 82091,
    fastestLapDisplay: "1:22.091",
    resultDriverAbbr: "VER",
    resultPosition: 1,
    resultLapTimeMs: 82091,
    resultLapsCompleted: 58,
    resultTyre: "soft" as const,
    resultGapMs: 0,
  },
  {
    roundNumber: 2,
    circuitSlug: "shanghai",
    gpName: "Chinese Grand Prix",
    scheduledStart: new Date("2026-03-15T07:00:00Z"),
    actualStart:    new Date("2026-03-15T07:00:00Z"),
    endedAt:        new Date("2026-03-15T09:10:00Z"),
    fastestLapDriverAbbr: "ANT",
    fastestLapMs: 95275,
    fastestLapDisplay: "1:35.275",
    resultDriverAbbr: "ANT",
    resultPosition: 1,
    resultLapTimeMs: 95275,
    resultLapsCompleted: 56,
    resultTyre: "medium" as const,
    resultGapMs: 0,
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // ── Provenance ─────────────────────────────────────────────────────────────
  const specsProv = await findOrCreateProvenance(
    "https://www.formula1.com/en/teams",
    "official",
    new Date("2026-01-15T10:00:00Z"),
    168,
  );
  const resultsProv = await findOrCreateProvenance(
    "https://www.formula1.com/en/results",
    "official",
    new Date("2026-03-16T16:30:00Z"),
    24,
  );
  const fastestLapProv = await findOrCreateProvenance(
    "https://www.formula1.com/en/results/2026/races",
    "official",
    new Date("2026-03-16T17:00:00Z"),
    24,
  );
  const editorialProv = await findOrCreateProvenance(
    "https://www.formula1.com/en/teams",
    "predicted",
    new Date("2026-02-01T10:00:00Z"),
    8760,
  );

  // ── Teams ──────────────────────────────────────────────────────────────────
  const teamMap: Record<string, string> = {}; // slug → id
  for (const t of TEAM_DATA) {
    const team = await prisma.team.upsert({
      where: { slug: t.slug },
      update: { name: t.name, short_name: t.short_name, power_unit: t.power_unit, color_primary: t.color },
      create: { slug: t.slug, name: t.name, short_name: t.short_name, power_unit: t.power_unit, color_primary: t.color },
    });
    teamMap[t.slug] = team.id;
  }
  console.log(`Teams upserted: ${Object.keys(teamMap).length}`);

  // ── Cars ───────────────────────────────────────────────────────────────────
  const carMap: Record<string, string> = {}; // teamSlug → carId
  for (const t of TEAM_DATA) {
    const car = await findOrCreateCar(teamMap[t.slug], 2026, t.car, specsProv.id);
    carMap[t.slug] = car.id;
  }
  console.log(`Cars upserted: ${Object.keys(carMap).length}`);

  // ── Circuits ───────────────────────────────────────────────────────────────
  const circuitMap: Record<string, string> = {}; // slug → id
  for (const c of CIRCUIT_DATA) {
    const circuit = await prisma.circuit.upsert({
      where: { slug: c.slug },
      update: { name: c.name, short_name: c.short, country: c.country, city: c.city, lap_length_km: c.km, total_laps_race: c.laps },
      create: { slug: c.slug, name: c.name, short_name: c.short, country: c.country, city: c.city, lap_length_km: c.km, total_laps_race: c.laps },
    });
    circuitMap[c.slug] = circuit.id;
  }
  console.log(`Circuits upserted: ${Object.keys(circuitMap).length}`);

  // ── Circuit Profiles ───────────────────────────────────────────────────────
  for (const c of CIRCUIT_DATA) {
    await prisma.circuitProfile.upsert({
      where: { circuit_id: circuitMap[c.slug] },
      update: {
        drag_sensitivity:              c.drag,
        traction_demand:               c.traction,
        braking_intensity:             c.braking,
        overtaking_potential:          c.overtaking,
        aero_zone_value:               c.aero,
        baseline_fastest_lap_s:        c.baseline,
        prediction_review_threshold_s: c.threshold,
      },
      create: {
        circuit_id:                    circuitMap[c.slug],
        drag_sensitivity:              c.drag,
        traction_demand:               c.traction,
        braking_intensity:             c.braking,
        overtaking_potential:          c.overtaking,
        aero_zone_value:               c.aero,
        baseline_fastest_lap_s:        c.baseline,
        prediction_review_threshold_s: c.threshold,
        provenance_id:                 specsProv.id,
      },
    });
  }
  console.log(`Circuit profiles upserted: ${CIRCUIT_DATA.length}`);

  // ── Rounds ─────────────────────────────────────────────────────────────────
  const roundMap: Record<number, string> = {}; // roundNumber → id
  for (let i = 0; i < CIRCUIT_DATA.length; i++) {
    const c = CIRCUIT_DATA[i];
    const roundNumber = i + 1;
    const isCompleted = roundNumber <= 2;
    const round = await prisma.round.upsert({
      where: { season_round_number: { season: 2026, round_number: roundNumber } },
      update: {
        circuit_id:          circuitMap[c.slug],
        name:                `${c.country === "Monaco" ? "Monaco" : c.country} Grand Prix`,
        status:              isCompleted ? "completed" : "upcoming",
        status_source:       "data",
        dab_zones_confirmed: isCompleted,
      },
      create: {
        circuit_id:          circuitMap[c.slug],
        season:              2026,
        round_number:        roundNumber,
        name:                `${c.country === "Monaco" ? "Monaco" : c.country} Grand Prix`,
        status:              isCompleted ? "completed" : "upcoming",
        status_source:       "data",
        dab_zones_confirmed: isCompleted,
      },
    });
    roundMap[roundNumber] = round.id;
  }
  // Fix round names that need custom text
  await prisma.round.update({ where: { id: roundMap[1]  }, data: { name: "Australian Grand Prix"     } });
  await prisma.round.update({ where: { id: roundMap[2]  }, data: { name: "Chinese Grand Prix"        } });
  await prisma.round.update({ where: { id: roundMap[3]  }, data: { name: "Japanese Grand Prix"       } });
  await prisma.round.update({ where: { id: roundMap[4]  }, data: { name: "Miami Grand Prix"          } });
  await prisma.round.update({ where: { id: roundMap[5]  }, data: { name: "Canadian Grand Prix"       } });
  await prisma.round.update({ where: { id: roundMap[6]  }, data: { name: "Monaco Grand Prix"         } });
  await prisma.round.update({ where: { id: roundMap[7]  }, data: { name: "Barcelona-Catalunya Grand Prix" } });
  await prisma.round.update({ where: { id: roundMap[8]  }, data: { name: "Austrian Grand Prix"       } });
  await prisma.round.update({ where: { id: roundMap[9]  }, data: { name: "British Grand Prix"        } });
  await prisma.round.update({ where: { id: roundMap[10] }, data: { name: "Belgian Grand Prix"        } });
  await prisma.round.update({ where: { id: roundMap[11] }, data: { name: "Hungarian Grand Prix"      } });
  await prisma.round.update({ where: { id: roundMap[12] }, data: { name: "Dutch Grand Prix"          } });
  await prisma.round.update({ where: { id: roundMap[13] }, data: { name: "Italian Grand Prix"        } });
  await prisma.round.update({ where: { id: roundMap[14] }, data: { name: "Spanish Grand Prix"        } });
  await prisma.round.update({ where: { id: roundMap[15] }, data: { name: "Azerbaijan Grand Prix"     } });
  await prisma.round.update({ where: { id: roundMap[16] }, data: { name: "Singapore Grand Prix"      } });
  await prisma.round.update({ where: { id: roundMap[17] }, data: { name: "United States Grand Prix"  } });
  await prisma.round.update({ where: { id: roundMap[18] }, data: { name: "Mexico City Grand Prix"    } });
  await prisma.round.update({ where: { id: roundMap[19] }, data: { name: "São Paulo Grand Prix"      } });
  await prisma.round.update({ where: { id: roundMap[20] }, data: { name: "Las Vegas Grand Prix"      } });
  await prisma.round.update({ where: { id: roundMap[21] }, data: { name: "Qatar Grand Prix"          } });
  await prisma.round.update({ where: { id: roundMap[22] }, data: { name: "Abu Dhabi Grand Prix"      } });
  console.log(`Rounds upserted: ${Object.keys(roundMap).length}`);

  // ── Drivers (sequential — number uniqueness requires ordered ops) ───────────
  // Upsert VER first to free number=1 (old seed stored VER as #1, now #3).
  const driverMap: Record<string, string> = {}; // abbr → id
  const verData = DRIVER_DATA.find((d) => d.abbr === "VER")!;
  const verRecord = await prisma.driver.upsert({
    where: { abbreviation: "VER" },
    update: { first_name: verData.first, last_name: verData.last, number: verData.number, nationality: verData.nationality },
    create: { first_name: verData.first, last_name: verData.last, abbreviation: "VER", number: verData.number, nationality: verData.nationality },
  });
  driverMap["VER"] = verRecord.id;

  for (const d of DRIVER_DATA) {
    if (d.abbr === "VER") continue; // already done
    const driver = await prisma.driver.upsert({
      where: { abbreviation: d.abbr },
      update: { first_name: d.first, last_name: d.last, number: d.number, nationality: d.nationality },
      create: { first_name: d.first, last_name: d.last, abbreviation: d.abbr, number: d.number, nationality: d.nationality },
    });
    driverMap[d.abbr] = driver.id;
  }
  console.log(`Drivers upserted: ${Object.keys(driverMap).length}`);

  // ── Driver Team Stints ─────────────────────────────────────────────────────
  for (const d of DRIVER_DATA) {
    await prisma.driverTeamStint.upsert({
      where: { driver_id_season_from_round: { driver_id: driverMap[d.abbr], season: 2026, from_round: 1 } },
      update: { team_id: teamMap[d.teamSlug], to_round: null },
      create: { driver_id: driverMap[d.abbr], team_id: teamMap[d.teamSlug], season: 2026, from_round: 1, to_round: null },
    });
  }
  console.log(`Driver team stints upserted: ${DRIVER_DATA.length}`);

  // ── Sessions + Results + Fastest Laps for completed rounds ─────────────────
  for (const cr of COMPLETED_ROUNDS) {
    const roundId = roundMap[cr.roundNumber];
    const session = await findOrCreateSession(
      roundId,
      "race",
      cr.scheduledStart,
      cr.actualStart,
      cr.endedAt,
    );
    const driverId = driverMap[cr.resultDriverAbbr];
    await prisma.sessionResult.upsert({
      where: { session_id_driver_id: { session_id: session.id, driver_id: driverId } },
      update: {
        position:         cr.resultPosition,
        classified:       true,
        lap_time_ms:      cr.resultLapTimeMs,
        gap_to_leader_ms: cr.resultGapMs,
        laps_completed:   cr.resultLapsCompleted,
        tyre_compound:    cr.resultTyre,
        provenance_id:    resultsProv.id,
      },
      create: {
        session_id:       session.id,
        driver_id:        driverId,
        position:         cr.resultPosition,
        classified:       true,
        lap_time_ms:      cr.resultLapTimeMs,
        gap_to_leader_ms: cr.resultGapMs,
        laps_completed:   cr.resultLapsCompleted,
        tyre_compound:    cr.resultTyre,
        provenance_id:    resultsProv.id,
      },
    });
    // FastestLap: find-or-create (no unique index)
    const flDriverId = driverMap[cr.fastestLapDriverAbbr];
    const existingFl = await prisma.fastestLap.findFirst({
      where: { round_id: roundId, driver_id: flDriverId },
    });
    if (!existingFl) {
      await prisma.fastestLap.create({
        data: {
          round_id:         roundId,
          session_id:       session.id,
          driver_id:        flDriverId,
          lap_time_ms:      cr.fastestLapMs,
          lap_time_display: cr.fastestLapDisplay,
          award_eligible:   true,
          provenance_id:    fastestLapProv.id,
        },
      });
    }
  }
  console.log(`Sessions, results, and fastest laps seeded for ${COMPLETED_ROUNDS.length} completed rounds`);

  // ── Editorial Predictions (delete + recreate for clean idempotency) ─────────
  await prisma.prediction.deleteMany({ where: { source_type: "editorial" } });

  const predictionRows: {
    prediction_type:        "fastest_lap";
    car_id:                 string;
    circuit_id:             string;
    round_valid_from:       number;
    predicted_value:        number;
    predicted_value_display:string;
    margin_of_error_ms:     number;
    confidence:             "low";
    source_type:            "editorial";
    provenance_id:          string;
  }[] = [];

  for (const t of TEAM_DATA) {
    const offsetMs = TEAM_OFFSET_MS[t.slug] ?? 1000;
    for (const c of CIRCUIT_DATA) {
      const predictedMs = Math.round(c.baseline * 1000 + offsetMs);
      predictionRows.push({
        prediction_type:         "fastest_lap",
        car_id:                  carMap[t.slug],
        circuit_id:              circuitMap[c.slug],
        round_valid_from:        0,
        predicted_value:         predictedMs,
        predicted_value_display: msToDisplay(predictedMs),
        margin_of_error_ms:      2000,
        confidence:              "low",
        source_type:             "editorial",
        provenance_id:           editorialProv.id,
      });
    }
  }

  await prisma.prediction.createMany({ data: predictionRows });
  console.log(`Editorial predictions created: ${predictionRows.length} (${TEAM_DATA.length} teams × ${CIRCUIT_DATA.length} circuits)`);

  // ── Verification ───────────────────────────────────────────────────────────
  const [teamCount, driverCount, circuitCount, roundCount, predCount] = await Promise.all([
    prisma.team.count(),
    prisma.driver.count(),
    prisma.circuit.count(),
    prisma.round.count(),
    prisma.prediction.count({ where: { source_type: "editorial" } }),
  ]);

  console.log("\n── Seed complete ─────────────────────────────────────────");
  console.log(`  Teams:                ${teamCount}`);
  console.log(`  Drivers:              ${driverCount}`);
  console.log(`  Circuits:             ${circuitCount}`);
  console.log(`  Rounds:               ${roundCount}`);
  console.log(`  Editorial predictions:${predCount}`);
  console.log("─────────────────────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
