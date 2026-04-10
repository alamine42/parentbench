/**
 * Score Drift Detection
 *
 * Detects when evaluation scores deviate significantly from the batch median,
 * indicating potential instability or a real change in model behavior.
 */

import { calculateMedian } from "./statistics";

const DRIFT_THRESHOLD = 15; // Points above which we consider it drift

export interface DriftBatch {
  id: string;
  modelId: string;
  targetRuns: number;
  completedRuns: number;
  failedRuns: number;
  maxRuns: number;
}

export interface DriftResult {
  driftDetected: boolean;
  driftAmount: number;
  additionalRunQueued: boolean;
  maxRunsReached: boolean;
  newTargetRuns?: number;
}

export interface DriftHandlerOptions {
  onMaxRunsReached?: (info: { batchId: string; modelId: string }) => void;
}

/**
 * Detect if a new score represents drift from the existing median.
 *
 * Returns true if the new score differs by more than 15 points from
 * the current median of existing scores.
 *
 * @param existingScores - Scores from previous runs in the batch
 * @param newScore - The new score to check
 * @returns true if drift detected, false otherwise
 */
export function detectDrift(existingScores: number[], newScore: number): boolean {
  // Need at least 2 existing scores to detect drift
  if (existingScores.length < 2) {
    return false;
  }

  const median = calculateMedian(existingScores);
  const difference = Math.abs(newScore - median);

  return difference > DRIFT_THRESHOLD;
}

/**
 * Check if we can trigger an additional drift run.
 *
 * Returns false if we've already hit the max runs limit.
 */
export function canTriggerDriftRun(batch: Pick<DriftBatch, "completedRuns" | "failedRuns" | "maxRuns">): boolean {
  const totalRuns = batch.completedRuns + batch.failedRuns;
  return totalRuns < batch.maxRuns;
}

/**
 * Calculate how much a score drifts from existing scores.
 *
 * @returns The absolute difference from the median, or 0 if no existing scores
 */
export function getDriftAmount(existingScores: number[], newScore: number): number {
  if (existingScores.length === 0) {
    return 0;
  }

  const median = calculateMedian(existingScores);
  return Math.abs(newScore - median);
}

/**
 * Handle drift detection and potentially queue additional runs.
 *
 * This function:
 * 1. Gets existing run scores for the batch
 * 2. Checks if the new score represents drift
 * 3. If drift detected and under max runs, queues another run
 * 4. If at max runs, calls the alert callback
 *
 * @param batch - The current batch state
 * @param newScore - The score from the just-completed run
 * @param options - Optional callbacks for events
 * @returns DriftResult indicating what happened
 */
export async function handleDrift(
  batch: DriftBatch,
  newScore: number,
  options: DriftHandlerOptions = {}
): Promise<DriftResult> {
  // For now, we assume existingScores would be fetched from the batch's runs
  // In real implementation, this would query the database
  // Here we simulate based on batch state
  const existingScores = await getExistingScoresForBatch(batch.id);

  // Need at least 2 existing scores to detect drift (same guard as detectDrift)
  if (existingScores.length < 2) {
    return {
      driftDetected: false,
      driftAmount: 0,
      additionalRunQueued: false,
      maxRunsReached: false,
    };
  }

  const driftAmount = getDriftAmount(existingScores, newScore);
  const driftDetected = driftAmount > DRIFT_THRESHOLD;

  if (!driftDetected) {
    return {
      driftDetected: false,
      driftAmount,
      additionalRunQueued: false,
      maxRunsReached: false,
    };
  }

  // Drift detected - check if we can queue more runs
  const totalRuns = batch.completedRuns + batch.failedRuns;
  const maxRunsReached = totalRuns >= batch.maxRuns;

  if (maxRunsReached) {
    // Alert admin that we can't queue more runs
    options.onMaxRunsReached?.({ batchId: batch.id, modelId: batch.modelId });

    return {
      driftDetected: true,
      driftAmount,
      additionalRunQueued: false,
      maxRunsReached: true,
    };
  }

  // Queue additional run, clamped to maxRuns
  const newTargetRuns = Math.min(batch.targetRuns + 1, batch.maxRuns);

  // Don't queue if we're already at the target
  if (newTargetRuns === batch.targetRuns) {
    return {
      driftDetected: true,
      driftAmount,
      additionalRunQueued: false,
      maxRunsReached: true,
    };
  }

  await queueAdditionalRun(batch.id, batch.modelId, newTargetRuns);

  return {
    driftDetected: true,
    driftAmount,
    additionalRunQueued: true,
    maxRunsReached: false,
    newTargetRuns,
  };
}

// ============================================================================
// INTERNAL HELPERS (would be replaced with real DB calls)
// ============================================================================

// In-memory store for testing - in production this queries the database
const batchScores = new Map<string, number[]>();

/**
 * Get existing scores for a batch (internal helper).
 * In production, this queries the evaluations table.
 */
async function getExistingScoresForBatch(batchId: string): Promise<number[]> {
  return batchScores.get(batchId) ?? [];
}

/**
 * Queue an additional evaluation run (internal helper).
 * In production, this sends an Inngest event.
 */
async function queueAdditionalRun(
  batchId: string,
  modelId: string,
  newTargetRuns: number
): Promise<void> {
  // In production: update batch targetRuns and send eval/requested event
  // For now, this is a no-op that would be mocked in tests
}

/**
 * Register scores for a batch (for testing).
 * @internal
 */
export function _registerBatchScores(batchId: string, scores: number[]): void {
  batchScores.set(batchId, scores);
}

/**
 * Clear all registered batch scores (for testing cleanup).
 * @internal
 */
export function _clearBatchScores(): void {
  batchScores.clear();
}
