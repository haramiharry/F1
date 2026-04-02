Loaded Prisma config from prisma.config.ts.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('fp1', 'fp2', 'fp3', 'qualifying', 'sprint_qualifying', 'sprint', 'race', 'round_aggregate');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('upcoming', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "RoundStatusSource" AS ENUM ('data', 'time_based', 'manual');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('official', 'derived', 'predicted', 'unavailable');

-- CreateEnum
CREATE TYPE "GearboxType" AS ENUM ('longitudinal', 'transverse', 'unavailable');

-- CreateEnum
CREATE TYPE "FieldAvailability" AS ENUM ('confirmed', 'unavailable');

-- CreateEnum
CREATE TYPE "TyreCompound" AS ENUM ('soft', 'medium', 'hard', 'intermediate', 'wet');

-- CreateEnum
CREATE TYPE "PredictionSourceType" AS ENUM ('model', 'editorial', 'hybrid');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "PredictionType" AS ENUM ('fastest_lap', 'strategy', 'track_fit', 'aero_effectiveness');

-- CreateEnum
CREATE TYPE "AdminQueueType" AS ENUM ('stale_provenance', 'hybrid_prediction_review', 'dab_zone_correction', 'round_aggregate_amendment', 'iqr_threshold_update');

-- CreateEnum
CREATE TYPE "AdminQueueStatus" AS ENUM ('pending', 'in_review', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "DabZoneStatus" AS ENUM ('confirmed', 'under_correction');

-- CreateEnum
CREATE TYPE "ThresholdSource" AS ENUM ('static_default', 'iqr_derived');

-- CreateEnum
CREATE TYPE "StagingPromotionStatus" AS ENUM ('pending', 'promoted', 'rejected');

-- CreateTable
CREATE TABLE "source_provenance" (
    "id" TEXT NOT NULL,
    "source_type" "SourceType" NOT NULL,
    "url" TEXT,
    "document_reference" TEXT,
    "accessed_at" TIMESTAMP(3) NOT NULL,
    "content_hash" TEXT,
    "stale_since" TIMESTAMP(3),
    "stale_threshold_hours" INTEGER NOT NULL DEFAULT 24,
    "is_stale" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_provenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT NOT NULL,
    "power_unit" TEXT NOT NULL,
    "color_primary" TEXT NOT NULL,
    "color_secondary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "nationality" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cars" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "designation" TEXT NOT NULL,
    "gearbox_type" "GearboxType" NOT NULL DEFAULT 'unavailable',
    "weight_kg" DOUBLE PRECISION,
    "fuel_capacity_l" DOUBLE PRECISION,
    "suspension_concept" TEXT,
    "notes" TEXT,
    "specs_provenance_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "circuits" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "lap_length_km" DOUBLE PRECISION NOT NULL,
    "total_laps_race" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "circuits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" TEXT NOT NULL,
    "circuit_id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "round_number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RoundStatus" NOT NULL DEFAULT 'upcoming',
    "status_source" "RoundStatusSource" NOT NULL DEFAULT 'data',
    "dab_zones_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "session_type" "SessionType" NOT NULL,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "scheduled_start" TIMESTAMP(3) NOT NULL,
    "actual_start" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "session_cancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancellation_reason" TEXT,
    "rescheduled_from_id" TEXT,
    "results_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "circuit_profiles" (
    "id" TEXT NOT NULL,
    "circuit_id" TEXT NOT NULL,
    "drag_sensitivity" DOUBLE PRECISION NOT NULL,
    "traction_demand" DOUBLE PRECISION NOT NULL,
    "braking_intensity" DOUBLE PRECISION NOT NULL,
    "overtaking_potential" DOUBLE PRECISION NOT NULL,
    "aero_zone_value" DOUBLE PRECISION NOT NULL,
    "baseline_fastest_lap_s" DOUBLE PRECISION NOT NULL,
    "prediction_review_threshold_s" DOUBLE PRECISION NOT NULL,
    "threshold_source" "ThresholdSource" NOT NULL DEFAULT 'static_default',
    "pending_threshold_update" DOUBLE PRECISION,
    "data_points_for_threshold" INTEGER NOT NULL DEFAULT 0,
    "provenance_id" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "circuit_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "circuit_dab_zones" (
    "id" TEXT NOT NULL,
    "circuit_id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "zone_number" INTEGER NOT NULL,
    "start_reference" TEXT NOT NULL,
    "end_reference" TEXT NOT NULL,
    "activation_direction" TEXT NOT NULL,
    "status" "DabZoneStatus" NOT NULL DEFAULT 'confirmed',
    "amendment_reason" TEXT,
    "superseded_at" TIMESTAMP(3),
    "superseded_by_id" TEXT,
    "provenance_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "circuit_dab_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "circuit_dab_zones_staging" (
    "id" TEXT NOT NULL,
    "circuit_id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "zone_number" INTEGER NOT NULL,
    "start_reference" TEXT NOT NULL,
    "end_reference" TEXT NOT NULL,
    "activation_direction" TEXT NOT NULL,
    "parse_errors" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewer_notes" TEXT,
    "promoted_at" TIMESTAMP(3),
    "promotion_status" "StagingPromotionStatus" NOT NULL DEFAULT 'pending',

    CONSTRAINT "circuit_dab_zones_staging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_results" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "position" INTEGER,
    "classified" BOOLEAN NOT NULL DEFAULT true,
    "lap_time_ms" INTEGER,
    "gap_to_leader_ms" INTEGER,
    "laps_completed" INTEGER,
    "tyre_compound" "TyreCompound",
    "provenance_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "session_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fastest_laps" (
    "id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "lap_time_ms" INTEGER NOT NULL,
    "lap_time_display" TEXT NOT NULL,
    "award_eligible" BOOLEAN NOT NULL DEFAULT true,
    "superseded_at" TIMESTAMP(3),
    "amendment_reason" TEXT,
    "superseded_by_id" TEXT,
    "provenance_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fastest_laps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "car_circuit_performance" (
    "id" TEXT NOT NULL,
    "car_id" TEXT NOT NULL,
    "circuit_id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "session_type" "SessionType" NOT NULL,
    "one_lap_pace" DOUBLE PRECISION,
    "long_run_pace" DOUBLE PRECISION,
    "straight_line_efficiency" DOUBLE PRECISION,
    "cornering_performance" DOUBLE PRECISION,
    "tyre_behaviour" DOUBLE PRECISION,
    "x_mode_effectiveness" DOUBLE PRECISION,
    "z_mode_effectiveness" DOUBLE PRECISION,
    "depends_on_dab_zones" BOOLEAN NOT NULL DEFAULT false,
    "recalculation_required" BOOLEAN NOT NULL DEFAULT false,
    "superseded_at" TIMESTAMP(3),
    "amendment_reason" TEXT,
    "superseded_by_id" TEXT,
    "provenance_id" TEXT NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "car_circuit_performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predictions" (
    "id" TEXT NOT NULL,
    "prediction_type" "PredictionType" NOT NULL,
    "car_id" TEXT,
    "driver_id" TEXT,
    "circuit_id" TEXT NOT NULL,
    "round_id" TEXT,
    "round_valid_from" INTEGER NOT NULL DEFAULT 0,
    "predicted_value" DOUBLE PRECISION,
    "predicted_value_display" TEXT,
    "margin_of_error_ms" DOUBLE PRECISION,
    "confidence" "ConfidenceLevel" NOT NULL DEFAULT 'low',
    "source_type" "PredictionSourceType" NOT NULL DEFAULT 'model',
    "original_model_output" DOUBLE PRECISION,
    "editorial_delta" DOUBLE PRECISION,
    "editorial_rationale" TEXT,
    "superseded_at" TIMESTAMP(3),
    "amendment_reason" TEXT,
    "superseded_by_id" TEXT,
    "editorial_review_required" BOOLEAN NOT NULL DEFAULT false,
    "model_recalc_pending" BOOLEAN NOT NULL DEFAULT false,
    "depends_on_dab_zones" BOOLEAN NOT NULL DEFAULT false,
    "recalculation_required" BOOLEAN NOT NULL DEFAULT false,
    "provenance_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_review_queue" (
    "id" TEXT NOT NULL,
    "queue_type" "AdminQueueType" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "AdminQueueStatus" NOT NULL DEFAULT 'pending',
    "assigned_to" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolution_notes" TEXT,

    CONSTRAINT "admin_review_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "car_field_status" (
    "id" TEXT NOT NULL,
    "car_id" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "status" "FieldAvailability" NOT NULL,
    "provenance_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "car_field_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_team_stints" (
    "id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "from_round" INTEGER NOT NULL,
    "to_round" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_team_stints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teams_slug_key" ON "teams"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_abbreviation_key" ON "drivers"("abbreviation");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_number_key" ON "drivers"("number");

-- CreateIndex
CREATE UNIQUE INDEX "circuits_slug_key" ON "circuits"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "rounds_season_round_number_key" ON "rounds"("season", "round_number");

-- CreateIndex
CREATE UNIQUE INDEX "circuit_profiles_circuit_id_key" ON "circuit_profiles"("circuit_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_results_session_id_driver_id_key" ON "session_results"("session_id", "driver_id");

-- CreateIndex
CREATE UNIQUE INDEX "car_field_status_car_id_field_name_key" ON "car_field_status"("car_id", "field_name");

-- CreateIndex
CREATE UNIQUE INDEX "driver_team_stints_driver_id_season_from_round_key" ON "driver_team_stints"("driver_id", "season", "from_round");

-- AddForeignKey
ALTER TABLE "cars" ADD CONSTRAINT "cars_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cars" ADD CONSTRAINT "cars_specs_provenance_id_fkey" FOREIGN KEY ("specs_provenance_id") REFERENCES "source_provenance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_circuit_id_fkey" FOREIGN KEY ("circuit_id") REFERENCES "circuits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_rescheduled_from_id_fkey" FOREIGN KEY ("rescheduled_from_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circuit_profiles" ADD CONSTRAINT "circuit_profiles_circuit_id_fkey" FOREIGN KEY ("circuit_id") REFERENCES "circuits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circuit_profiles" ADD CONSTRAINT "circuit_profiles_provenance_id_fkey" FOREIGN KEY ("provenance_id") REFERENCES "source_provenance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circuit_dab_zones" ADD CONSTRAINT "circuit_dab_zones_circuit_id_fkey" FOREIGN KEY ("circuit_id") REFERENCES "circuits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circuit_dab_zones" ADD CONSTRAINT "circuit_dab_zones_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circuit_dab_zones" ADD CONSTRAINT "circuit_dab_zones_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "circuit_dab_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circuit_dab_zones" ADD CONSTRAINT "circuit_dab_zones_provenance_id_fkey" FOREIGN KEY ("provenance_id") REFERENCES "source_provenance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circuit_dab_zones_staging" ADD CONSTRAINT "circuit_dab_zones_staging_circuit_id_fkey" FOREIGN KEY ("circuit_id") REFERENCES "circuits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circuit_dab_zones_staging" ADD CONSTRAINT "circuit_dab_zones_staging_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_results" ADD CONSTRAINT "session_results_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_results" ADD CONSTRAINT "session_results_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_results" ADD CONSTRAINT "session_results_provenance_id_fkey" FOREIGN KEY ("provenance_id") REFERENCES "source_provenance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fastest_laps" ADD CONSTRAINT "fastest_laps_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fastest_laps" ADD CONSTRAINT "fastest_laps_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fastest_laps" ADD CONSTRAINT "fastest_laps_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fastest_laps" ADD CONSTRAINT "fastest_laps_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "fastest_laps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fastest_laps" ADD CONSTRAINT "fastest_laps_provenance_id_fkey" FOREIGN KEY ("provenance_id") REFERENCES "source_provenance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "car_circuit_performance" ADD CONSTRAINT "car_circuit_performance_car_id_fkey" FOREIGN KEY ("car_id") REFERENCES "cars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "car_circuit_performance" ADD CONSTRAINT "car_circuit_performance_circuit_id_fkey" FOREIGN KEY ("circuit_id") REFERENCES "circuits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "car_circuit_performance" ADD CONSTRAINT "car_circuit_performance_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "car_circuit_performance" ADD CONSTRAINT "car_circuit_performance_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "car_circuit_performance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "car_circuit_performance" ADD CONSTRAINT "car_circuit_performance_provenance_id_fkey" FOREIGN KEY ("provenance_id") REFERENCES "source_provenance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_car_id_fkey" FOREIGN KEY ("car_id") REFERENCES "cars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_circuit_id_fkey" FOREIGN KEY ("circuit_id") REFERENCES "circuits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "predictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_provenance_id_fkey" FOREIGN KEY ("provenance_id") REFERENCES "source_provenance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "car_field_status" ADD CONSTRAINT "car_field_status_car_id_fkey" FOREIGN KEY ("car_id") REFERENCES "cars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "car_field_status" ADD CONSTRAINT "car_field_status_provenance_id_fkey" FOREIGN KEY ("provenance_id") REFERENCES "source_provenance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_team_stints" ADD CONSTRAINT "driver_team_stints_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_team_stints" ADD CONSTRAINT "driver_team_stints_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

