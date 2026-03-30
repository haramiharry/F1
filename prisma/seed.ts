// Prisma seed — round anchor data for F1 2026.
//
// Seeds the minimum relational data needed to populate:
//   Round 1 · Australia — fastest lap: VER 1:22.091 (82,091 ms)
//   Round 2 · China     — fastest lap: ANT 1:35.275 (95,275 ms)
//
// These are the "seed anchor results" used to validate the ingestion pipeline,
// the amendment chain, and the lap-time display format before live data arrives.
//
// Run via:
//   npx prisma db seed
//
// Prerequisites:
//   npx prisma migrate dev   (apply schema)
//   sqlite3 dev.db < prisma/manual/001_session_partial_unique.sql
//   sqlite3 dev.db < prisma/manual/002_car_circuit_performance_partial_unique.sql
//   sqlite3 dev.db < prisma/manual/003_predictions_partial_unique.sql

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // -------------------------------------------------------------------------
  // Provenance records (permanent audit trail — one per data source type)
  // -------------------------------------------------------------------------

  const specsProv = await prisma.sourceProvenance.create({
    data: {
      source_type: "official",
      url: "https://www.formula1.com/en/teams",
      accessed_at: new Date("2026-01-15T10:00:00Z"),
      stale_threshold_hours: 168, // 7 days for FIA documents
    },
  });

  const resultsProv = await prisma.sourceProvenance.create({
    data: {
      source_type: "official",
      url: "https://www.formula1.com/en/results",
      accessed_at: new Date("2026-03-16T16:30:00Z"),
      stale_threshold_hours: 24,
    },
  });

  const fastestLapProv = await prisma.sourceProvenance.create({
    data: {
      source_type: "official",
      url: "https://www.formula1.com/en/results/2026/races",
      accessed_at: new Date("2026-03-16T17:00:00Z"),
      stale_threshold_hours: 24,
    },
  });

  // -------------------------------------------------------------------------
  // Teams
  // -------------------------------------------------------------------------

  const teamRedbull = await prisma.team.create({
    data: {
      slug: "redbull",
      name: "Oracle Red Bull Racing",
      short_name: "Red Bull",
      power_unit: "Honda RBPT",
      color_primary: "#3671C6",
    },
  });

  const teamMercedes = await prisma.team.create({
    data: {
      slug: "mercedes",
      name: "Mercedes-AMG PETRONAS F1 Team",
      short_name: "Mercedes",
      power_unit: "Mercedes",
      color_primary: "#27F4D2",
    },
  });

  // -------------------------------------------------------------------------
  // Cars
  // -------------------------------------------------------------------------

  const carRedbull = await prisma.car.create({
    data: {
      team_id: teamRedbull.id,
      season: 2026,
      designation: "RB26",
      specs_provenance_id: specsProv.id,
    },
  });

  const carMercedes = await prisma.car.create({
    data: {
      team_id: teamMercedes.id,
      season: 2026,
      designation: "W17",
      specs_provenance_id: specsProv.id,
    },
  });

  // -------------------------------------------------------------------------
  // Circuits
  // -------------------------------------------------------------------------

  const circuitAustralia = await prisma.circuit.create({
    data: {
      slug: "albert-park",
      name: "Albert Park Circuit",
      short_name: "Albert Park",
      country: "Australia",
      city: "Melbourne",
      lap_length_km: 5.278,
      total_laps_race: 58,
    },
  });

  const circuitChina = await prisma.circuit.create({
    data: {
      slug: "shanghai",
      name: "Shanghai International Circuit",
      short_name: "Shanghai",
      country: "China",
      city: "Shanghai",
      lap_length_km: 5.451,
      total_laps_race: 56,
    },
  });

  // -------------------------------------------------------------------------
  // Rounds (both completed — post-season seed)
  // -------------------------------------------------------------------------

  const round1 = await prisma.round.create({
    data: {
      circuit_id: circuitAustralia.id,
      season: 2026,
      round_number: 1,
      name: "Australian Grand Prix",
      status: "completed",
      status_source: "data",
      dab_zones_confirmed: true,
    },
  });

  const round2 = await prisma.round.create({
    data: {
      circuit_id: circuitChina.id,
      season: 2026,
      round_number: 2,
      name: "Chinese Grand Prix",
      status: "completed",
      status_source: "data",
      dab_zones_confirmed: true,
    },
  });

  // -------------------------------------------------------------------------
  // Race sessions
  // -------------------------------------------------------------------------

  const r1Race = await prisma.session.create({
    data: {
      round_id: round1.id,
      session_type: "race",
      scheduled_start: new Date("2026-03-15T05:00:00Z"),
      actual_start:    new Date("2026-03-15T05:00:00Z"),
      ended_at:        new Date("2026-03-15T07:02:00Z"),
    },
  });

  const r2Race = await prisma.session.create({
    data: {
      round_id: round2.id,
      session_type: "race",
      scheduled_start: new Date("2026-03-22T07:00:00Z"),
      actual_start:    new Date("2026-03-22T07:00:00Z"),
      ended_at:        new Date("2026-03-22T09:08:00Z"),
    },
  });

  // -------------------------------------------------------------------------
  // Drivers
  // -------------------------------------------------------------------------

  const driverVer = await prisma.driver.create({
    data: {
      first_name:   "Max",
      last_name:    "Verstappen",
      abbreviation: "VER",
      number:       1,
      nationality:  "Dutch",
    },
  });

  const driverAnt = await prisma.driver.create({
    data: {
      first_name:   "Kimi",
      last_name:    "Antonelli",
      abbreviation: "ANT",
      number:       12,
      nationality:  "Italian",
    },
  });

  // -------------------------------------------------------------------------
  // Driver team stints (active — to_round NULL = current)
  // -------------------------------------------------------------------------

  await prisma.driverTeamStint.create({
    data: {
      driver_id:  driverVer.id,
      team_id:    teamRedbull.id,
      season:     2026,
      from_round: 1,
      to_round:   null,
    },
  });

  await prisma.driverTeamStint.create({
    data: {
      driver_id:  driverAnt.id,
      team_id:    teamMercedes.id,
      season:     2026,
      from_round: 1,
      to_round:   null,
    },
  });

  // -------------------------------------------------------------------------
  // Session results (race finishing positions for fastest-lap drivers)
  // VER won R1; ANT won R2. lap_time_ms = the posted fastest lap.
  // -------------------------------------------------------------------------

  await prisma.sessionResult.create({
    data: {
      session_id:       r1Race.id,
      driver_id:        driverVer.id,
      position:         1,
      classified:       true,
      lap_time_ms:      82091, // 1:22.091
      gap_to_leader_ms: 0,
      laps_completed:   58,
      tyre_compound:    "soft",
      provenance_id:    resultsProv.id,
    },
  });

  await prisma.sessionResult.create({
    data: {
      session_id:       r2Race.id,
      driver_id:        driverAnt.id,
      position:         1,
      classified:       true,
      lap_time_ms:      95275, // 1:35.275
      gap_to_leader_ms: 0,
      laps_completed:   56,
      tyre_compound:    "medium",
      provenance_id:    resultsProv.id,
    },
  });

  // -------------------------------------------------------------------------
  // Fastest lap records — the primary seed anchor assertions.
  //
  // VER 1:22.091 (82,091 ms) — Round 1, Albert Park
  // ANT 1:35.275 (95,275 ms) — Round 2, Shanghai
  //
  // Display format validation (msToDisplay logic in WeekendScreen):
  //   82091 → totalSeconds=82, m=1, s=22, ms=091 → "1:22.091" ✓
  //   95275 → totalSeconds=95, m=1, s=35, ms=275 → "1:35.275" ✓
  // -------------------------------------------------------------------------

  const fl1 = await prisma.fastestLap.create({
    data: {
      round_id:          round1.id,
      session_id:        r1Race.id,
      driver_id:         driverVer.id,
      lap_time_ms:       82091,
      lap_time_display:  "1:22.091",
      award_eligible:    true,
      provenance_id:     fastestLapProv.id,
    },
  });

  const fl2 = await prisma.fastestLap.create({
    data: {
      round_id:          round2.id,
      session_id:        r2Race.id,
      driver_id:         driverAnt.id,
      lap_time_ms:       95275,
      lap_time_display:  "1:35.275",
      award_eligible:    true,
      provenance_id:     fastestLapProv.id,
    },
  });

  // -------------------------------------------------------------------------
  // Verification output — confirm seed anchor assertions
  // -------------------------------------------------------------------------

  const verifyFl1 = await prisma.fastestLap.findFirst({
    where: { id: fl1.id },
    include: { driver: true, round: { include: { circuit: true } } },
  });

  const verifyFl2 = await prisma.fastestLap.findFirst({
    where: { id: fl2.id },
    include: { driver: true, round: { include: { circuit: true } } },
  });

  console.log("Seed anchor results:");
  console.log(
    `  R1 ${verifyFl1?.round.circuit.country}: ` +
    `${verifyFl1?.driver.abbreviation} ${verifyFl1?.lap_time_display} ` +
    `(${verifyFl1?.lap_time_ms} ms)`
  );
  console.log(
    `  R2 ${verifyFl2?.round.circuit.country}: ` +
    `${verifyFl2?.driver.abbreviation} ${verifyFl2?.lap_time_display} ` +
    `(${verifyFl2?.lap_time_ms} ms)`
  );
  console.log();
  console.log(
    "Cars seeded:",
    [carRedbull.designation, carMercedes.designation].join(", ")
  );
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
