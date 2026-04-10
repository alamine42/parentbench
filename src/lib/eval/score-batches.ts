/**
 * Score Batches
 *
 * Manages multi-run evaluation batches with version pinning,
 * progress tracking, failure handling, and score finalization.
 */

import { createHash } from "crypto";
import { computeBatchStatistics, type ConfidenceLevel } from "./statistics";

// ============================================================================
// TYPES
// ============================================================================

export interface ScoreBatch {
  id: string;
  modelId: string;
  methodologyVersion: string;
  testSuiteHash: string;
  modelVersion: string | null;
  status: "pending" | "in_progress" | "completed" | "failed";
  targetRuns: number;
  completedRuns: number;
  failedRuns: number;
  maxRuns: number;
  medianScore: number | null;
  minScore: number | null;
  maxScore: number | null;
  variance: number | null;
  confidence: ConfidenceLevel | null;
  lastError: string | null;
  retryCount: number;
  triggeredBy: string;
  createdAt: Date;
  completedAt: Date | null;
}

export interface CreateBatchOptions {
  modelVersion?: string;
}

export interface UpdateProgressResult {
  success: boolean;
  score?: number;
  error?: string;
}

export interface FinalizedBatch extends ScoreBatch {
  isPartial: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_TARGET_RUNS = 3;
const DEFAULT_MAX_RUNS = 5;
const DEFAULT_MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;

// ============================================================================
// IN-MEMORY STORE (would be replaced with database in production)
// ============================================================================

const batches = new Map<string, ScoreBatch>();
const batchScores = new Map<string, number[]>(); // batchId -> array of scores

// Simulated methodology version and test suite
let currentMethodologyVersion = "2026-04-01";
let currentTestSuiteHash = "default-hash-for-testing";

// ============================================================================
// PUBLIC FUNCTIONS
// ============================================================================

/**
 * Create a new score batch for a model.
 *
 * Pins the current methodology version and test suite hash.
 */
export async function createScoreBatch(
  modelId: string,
  triggeredBy: string,
  options: CreateBatchOptions = {}
): Promise<ScoreBatch> {
  const id = `batch-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const testSuiteHash = await computeTestSuiteHash();

  const batch: ScoreBatch = {
    id,
    modelId,
    methodologyVersion: currentMethodologyVersion,
    testSuiteHash,
    modelVersion: options.modelVersion ?? null,
    status: "pending",
    targetRuns: DEFAULT_TARGET_RUNS,
    completedRuns: 0,
    failedRuns: 0,
    maxRuns: DEFAULT_MAX_RUNS,
    medianScore: null,
    minScore: null,
    maxScore: null,
    variance: null,
    confidence: null,
    lastError: null,
    retryCount: 0,
    triggeredBy,
    createdAt: new Date(),
    completedAt: null,
  };

  batches.set(id, batch);
  batchScores.set(id, []);

  return batch;
}

/**
 * Validate that the current test suite matches what was pinned at batch creation.
 *
 * @throws Error if the test suite has changed
 */
export async function validateRunVersion(batchId: string): Promise<void> {
  const batch = batches.get(batchId);
  if (!batch) {
    throw new Error(`Batch ${batchId} not found`);
  }

  const currentHash = await computeTestSuiteHash();
  if (batch.testSuiteHash !== currentHash) {
    throw new Error("Test suite changed since batch created. Requeue fresh batch.");
  }
}

/**
 * Update batch progress after a run completes.
 */
export async function updateBatchProgress(
  batchId: string,
  result: UpdateProgressResult
): Promise<ScoreBatch> {
  const batch = batches.get(batchId);
  if (!batch) {
    throw new Error(`Batch ${batchId} not found`);
  }

  if (result.success && result.score !== undefined) {
    batch.completedRuns += 1;
    const scores = batchScores.get(batchId) ?? [];
    scores.push(result.score);
    batchScores.set(batchId, scores);
  } else if (!result.success) {
    batch.failedRuns += 1;
    batch.lastError = result.error ?? null;
  }

  // Transition from pending to in_progress on first update
  if (batch.status === "pending") {
    batch.status = "in_progress";
  }

  batches.set(batchId, batch);
  return batch;
}

/**
 * Check if a batch is complete (all runs done or max reached).
 */
export function isBatchComplete(batch: Pick<ScoreBatch, "targetRuns" | "completedRuns" | "failedRuns" | "maxRuns">): boolean {
  // Complete if we have enough successful runs
  if (batch.completedRuns >= batch.targetRuns) {
    return true;
  }

  // Also complete if we've hit max runs (success + failure)
  const totalRuns = batch.completedRuns + batch.failedRuns;
  if (totalRuns >= batch.maxRuns) {
    return true;
  }

  return false;
}

/**
 * Handle a failed run with retry tracking.
 */
export async function handleRunFailure(
  batchId: string,
  errorMessage: string
): Promise<ScoreBatch> {
  const batch = batches.get(batchId);
  if (!batch) {
    throw new Error(`Batch ${batchId} not found`);
  }

  batch.failedRuns += 1;
  batch.lastError = errorMessage;
  batch.retryCount += 1;

  // Check if we should mark the batch as failed
  // (all retries exhausted for all runs)
  const totalRuns = batch.completedRuns + batch.failedRuns;
  if (batch.retryCount >= DEFAULT_MAX_RETRIES * batch.targetRuns && batch.completedRuns === 0) {
    batch.status = "failed";
    batch.completedAt = new Date();
  }

  batches.set(batchId, batch);
  return batch;
}

/**
 * Check if we should retry a failed run.
 */
export function shouldRetry(batch: { retryCount: number; maxRetries?: number }): boolean {
  const maxRetries = batch.maxRetries ?? DEFAULT_MAX_RETRIES;
  return batch.retryCount < maxRetries;
}

/**
 * Mark a batch as failed.
 */
export async function markBatchFailed(
  batchId: string,
  errorMessage: string
): Promise<ScoreBatch> {
  const batch = batches.get(batchId);
  if (!batch) {
    throw new Error(`Batch ${batchId} not found`);
  }

  batch.status = "failed";
  batch.lastError = errorMessage;
  batch.completedAt = new Date();

  batches.set(batchId, batch);
  return batch;
}

/**
 * Get a batch by ID.
 */
export async function getBatch(batchId: string): Promise<ScoreBatch> {
  const batch = batches.get(batchId);
  if (!batch) {
    throw new Error(`Batch ${batchId} not found`);
  }
  return batch;
}

/**
 * Finalize a batch by computing statistics from completed runs.
 */
export async function finalizeBatch(batchId: string): Promise<FinalizedBatch> {
  const batch = batches.get(batchId);
  if (!batch) {
    throw new Error(`Batch ${batchId} not found`);
  }

  const scores = batchScores.get(batchId) ?? [];

  if (scores.length === 0) {
    // No successful runs - mark as failed
    batch.status = "failed";
    batch.completedAt = new Date();
    batches.set(batchId, batch);
    return { ...batch, isPartial: true };
  }

  // Compute statistics
  const stats = computeBatchStatistics(scores);

  batch.medianScore = stats.medianScore;
  batch.minScore = stats.minScore;
  batch.maxScore = stats.maxScore;
  batch.variance = stats.variance;
  batch.confidence = stats.confidence;
  batch.status = "completed";
  batch.completedAt = new Date();

  batches.set(batchId, batch);

  // Is this a partial batch (fewer runs than target)?
  const isPartial = batch.completedRuns < batch.targetRuns;

  return { ...batch, isPartial };
}

/**
 * Calculate retry delay with exponential backoff.
 */
export function calculateRetryDelay(attempt: number): number {
  const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
  return Math.min(delay, MAX_RETRY_DELAY_MS);
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Compute a hash of the current active test cases.
 * In production, this queries the database.
 */
async function computeTestSuiteHash(): Promise<string> {
  // In production, this would:
  // 1. Get all active test case IDs
  // 2. Sort them
  // 3. Hash the result
  return currentTestSuiteHash;
}

// ============================================================================
// TEST HELPERS (internal use only)
// ============================================================================

/**
 * Set the current methodology version (for testing).
 * @internal
 */
export function _setMethodologyVersion(version: string): void {
  currentMethodologyVersion = version;
}

/**
 * Set the current test suite hash (for testing).
 * @internal
 */
export function _setTestSuiteHash(hash: string): void {
  currentTestSuiteHash = hash;
}

/**
 * Clear all batches (for testing cleanup).
 * @internal
 */
export function _clearBatches(): void {
  batches.clear();
  batchScores.clear();
}

/**
 * Get all batch scores (for testing).
 * @internal
 */
export function _getBatchScores(batchId: string): number[] {
  return batchScores.get(batchId) ?? [];
}
