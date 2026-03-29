// Shared types for the Step 6 Predictive Module.
//
// FastestLapEstimateInput   — arguments passed to computeFastestLapPrediction
// CircuitSimilarityScore    — one entry in the sorted similarity list returned
//                             by findSimilarCircuits
// PredictionEngineResult    — summary returned by runPredictionEngineForSession

export interface FastestLapEstimateInput {
  carId: string;
  circuitId: string;
  roundId: string;
  roundNumber: number;
}

// One result from the circuit similarity search.
// distance: Euclidean distance in 5D profile space (lower = more similar)
// similarity: 0–1 linear score derived from distance (1 = identical profile)
export interface CircuitSimilarityScore {
  circuitId: string;
  distance: number;
  similarity: number;
}

export interface PredictionEngineResult {
  success: boolean;
  predictionsWritten: number;
  errors: string[];
}
