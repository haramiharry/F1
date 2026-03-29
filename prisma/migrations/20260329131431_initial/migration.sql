-- CreateTable
CREATE TABLE "source_provenance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_type" TEXT NOT NULL,
    "url" TEXT,
    "document_reference" TEXT,
    "accessed_at" DATETIME NOT NULL,
    "content_hash" TEXT,
    "stale_since" DATETIME,
    "stale_threshold_hours" INTEGER NOT NULL DEFAULT 24,
    "is_stale" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT NOT NULL,
    "power_unit" TEXT NOT NULL,
    "color_primary" TEXT NOT NULL,
    "color_secondary" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "nationality" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME
);

-- CreateTable
CREATE TABLE "cars" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "team_id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "designation" TEXT NOT NULL,
    "gearbox_type" TEXT NOT NULL DEFAULT 'unavailable',
    "weight_kg" REAL,
    "fuel_capacity_l" REAL,
    "suspension_concept" TEXT,
    "notes" TEXT,
    "specs_provenance_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME,
    CONSTRAINT "cars_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cars_specs_provenance_id_fkey" FOREIGN KEY ("specs_provenance_id") REFERENCES "source_provenance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "circuits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "lap_length_km" REAL NOT NULL,
    "total_laps_race" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "circuit_id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "round_number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "status_source" TEXT NOT NULL DEFAULT 'data',
    "dab_zones_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME,
    CONSTRAINT "rounds_circuit_id_fkey" FOREIGN KEY ("circuit_id") REFERENCES "circuits" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "round_id" TEXT NOT NULL,
    "session_type" TEXT NOT NULL,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "scheduled_start" DATETIME NOT NULL,
    "actual_start" DATETIME,
    "ended_at" DATETIME,
    "session_cancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancellation_reason" TEXT,
    "rescheduled_from_id" TEXT,
    "results_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME,
    CONSTRAINT "sessions_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sessions_rescheduled_from_id_fkey" FOREIGN KEY ("rescheduled_from_id") REFERENCES "sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "circuit_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "circuit_id" TEXT NOT NULL,
    "drag_sensitivity" REAL NOT NULL,
    "traction_demand" REAL NOT NULL,
    "braking_intensity" REAL NOT NULL,
    "overtaking_potential" REAL NOT NULL,
    "aero_zone_value" REAL NOT NULL,
    "baseline_fastest_lap_s" REAL NOT NULL,
    "prediction_review_threshold_s" REAL NOT NULL,
    "threshold_source" TEXT NOT NULL DEFAULT 'static_default',
    "pending_threshold_update" REAL,
    "data_points_for_threshold" INTEGER NOT NULL DEFAULT 0,
    "provenance_id" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "circuit_profiles_circuit_id_fkey" FOREIGN KEY ("circuit_id") REFERENCES "circuits" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "circuit_profiles_provenance_id_fkey" FOREIGN KEY ("provenance_id") REFERENCES "source_provenance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "circuit_dab_zones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "circuit_id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "zone_number" INTEGER NOT NULL,
    "start_reference" TEXT NOT NULL,
    "end_reference" TEXT NOT NULL,
    "activation_direction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "amendment_reason" TEXT,
    "superseded_at" DATETIME,
    "superseded_by_id" TEXT,
    "provenance_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "circuit_dab_zones_circuit_id_fkey" FOREIGN KEY ("circuit_id") REFERENCES "circuits" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "circuit_dab_zones_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "circuit_dab_zones_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "circuit_dab_zones" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "circuit_dab_zones_provenance_id_fkey" FOREIGN KEY ("provenance_id") REFERENCES "source_provenance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "circuit_dab_zones_staging" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "circuit_id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "zone_number" INTEGER NOT NULL,
    "start_reference" TEXT NOT NULL,
    "end_reference" TEXT NOT NULL,
    "activation_direction" TEXT NOT NULL,
    "parse_errors" TEXT,
    "submitted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" DATETIME,
    "reviewer_notes" TEXT,
    "promoted_at" DATETIME,
    "promotion_status" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "circuit_dab_zones_staging_circuit_id_fkey" FOREIGN KEY ("circuit_id") REFERENCES "circuits" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "circuit_dab_zones_staging_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "session_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "position" INTEGER,
    "classified" BOOLEAN NOT NULL DEFAULT true,
    "lap_time_ms" INTEGER,
    "gap_to_leader_ms" INTEGER,
    "laps_completed" INTEGER,
    "tyre_compound" TEXT,
    "provenance_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME,
    CONSTRAINT "session_results_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "session_results_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "session_results_provenance_id_fkey" FOREIGN KEY ("provenance_id") REFERENCES "source_provenance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "fastest_laps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "round_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "lap_time_ms" INTEGER NOT NULL,
    "lap_time_display" TEXT NOT NULL,
    "award_eligible" BOOLEAN NOT NULL DEFAULT true,
    "superseded_at" DATETIME,
    "amendment_reason" TEXT,
    "superseded_by_id" TEXT,
    "provenance_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fastest_laps_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fastest_laps_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fastest_laps_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fastest_laps_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "fastest_laps" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fastest_laps_provenance_id_fkey" FOREIGN KEY ("provenance_id") REFERENCES "source_provenance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "car_circuit_performance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "car_id" TEXT NOT NULL,
    "circuit_id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "session_type" TEXT NOT NULL,
    "one_lap_pace" REAL,
    "long_run_pace" REAL,
    "straight_line_efficiency" REAL,
    "cornering_performance" REAL,
    "tyre_behaviour" REAL,
    "x_mode_effectiveness" REAL,
    "z_mode_effectiveness" REAL,
    "depends_on_dab_zones" BOOLEAN NOT NULL DEFAULT false,
    "recalculation_required" BOOLEAN NOT NULL DEFAULT false,
    "superseded_at" DATETIME,
    "amendment_reason" TEXT,
    "superseded_by_id" TEXT,
    "provenance_id" TEXT NOT NULL,
    "calculated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME,
    CONSTRAINT "car_circuit_performance_car_id_fkey" FOREIGN KEY ("car_id") REFERENCES "cars" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "car_circuit_performance_circuit_id_fkey" FOREIGN KEY ("circuit_id") REFERENCES "circuits" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "car_circuit_performance_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "car_circuit_performance_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "car_circuit_performance" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "car_circuit_performance_provenance_id_fkey" FOREIGN KEY ("provenance_id") REFERENCES "source_provenance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "predictions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prediction_type" TEXT NOT NULL,
    "car_id" TEXT,
    "driver_id" TEXT,
    "circuit_id" TEXT NOT NULL,
    "round_id" TEXT,
    "round_valid_from" INTEGER NOT NULL DEFAULT 0,
    "predicted_value" REAL,
    "predicted_value_display" TEXT,
    "margin_of_error_ms" REAL,
    "confidence" TEXT NOT NULL DEFAULT 'low',
    "source_type" TEXT NOT NULL DEFAULT 'model',
    "original_model_output" REAL,
    "editorial_delta" REAL,
    "editorial_rationale" TEXT,
    "superseded_at" DATETIME,
    "amendment_reason" TEXT,
    "superseded_by_id" TEXT,
    "editorial_review_required" BOOLEAN NOT NULL DEFAULT false,
    "model_recalc_pending" BOOLEAN NOT NULL DEFAULT false,
    "depends_on_dab_zones" BOOLEAN NOT NULL DEFAULT false,
    "recalculation_required" BOOLEAN NOT NULL DEFAULT false,
    "provenance_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "predictions_car_id_fkey" FOREIGN KEY ("car_id") REFERENCES "cars" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "predictions_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "predictions_circuit_id_fkey" FOREIGN KEY ("circuit_id") REFERENCES "circuits" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "predictions_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "predictions_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "predictions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "predictions_provenance_id_fkey" FOREIGN KEY ("provenance_id") REFERENCES "source_provenance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "admin_review_queue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "queue_type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "assigned_to" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" DATETIME,
    "resolution_notes" TEXT
);

-- CreateTable
CREATE TABLE "car_field_status" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "car_id" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provenance_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "car_field_status_car_id_fkey" FOREIGN KEY ("car_id") REFERENCES "cars" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "car_field_status_provenance_id_fkey" FOREIGN KEY ("provenance_id") REFERENCES "source_provenance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "driver_team_stints" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "driver_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "from_round" INTEGER NOT NULL,
    "to_round" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "driver_team_stints_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "driver_team_stints_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
