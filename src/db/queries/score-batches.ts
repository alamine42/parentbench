/**
 * Score Batches Database Queries
 *
 * Database operations for multi-run evaluation batches with statistical robustness tracking.
 */

import { db } from "@/db";
import {
  scoreBatches,
  batchRunScores,
  scores,
  evaluations,
  testCases,
} from "@/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { createHash } from "crypto";

// ============================================================================
// TYPES
// ============================================================================

export type ScoreBatchWithRuns = typeof scoreBatches.$inferSelect & {
  runScores: Array<typeof batchRunScores.$inferSelect>;
};

export type CreateBatchInput = {
  modelId: string;
  triggeredBy: string;
  modelVersion?: string;
};

export type UpdateBatchProgressInput = {
  success: boolean;
  score?: number;
  evaluationId?: string;
  error?: string;
};

// ============================================================================
// CONSTANTS
// ============================================================================

// Current methodology version - increment when scoring logic changes
export const CURRENT_METHODOLOGY_VERSION = "2026-04-01";

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Create a new score batch for a model.
 * Pins the current methodology version and test suite hash.
 */
export async function createScoreBatch(input: CreateBatchInput) {
  const testSuiteHash = await computeTestSuiteHash();

  const [batch] = await db
    .insert(scoreBatches)
    .values({
      modelId: input.modelId,
      methodologyVersion: CURRENT_METHODOLOGY_VERSION,
      testSuiteHash,
      modelVersion: input.modelVersion ?? null,
      triggeredBy: input.triggeredBy,
      status: "pending",
      targetRuns: 3,
      completedRuns: 0,
      failedRuns: 0,
      maxRuns: 5,
      maxRetries: 3,
      retryCount: 0,
    })
    .returning();

  return batch;
}

/**
 * Get a batch by ID.
 */
export async function getBatch(batchId: string) {
  const [batch] = await db
    .select()
    .from(scoreBatches)
    .where(eq(scoreBatches.id, batchId))
    .limit(1);

  return batch ?? null;
}

/**
 * Get a batch with all its run scores.
 */
export async function getBatchWithRuns(batchId: string): Promise<ScoreBatchWithRuns | null> {
  const [batch] = await db
    .select()
    .from(scoreBatches)
    .where(eq(scoreBatches.id, batchId))
    .limit(1);

  if (!batch) return null;

  const runScores = await db
    .select()
    .from(batchRunScores)
    .where(eq(batchRunScores.batchId, batchId))
    .orderBy(batchRunScores.runNumber);

  return { ...batch, runScores };
}

/**
 * Get the active (pending or in_progress) batch for a model.
 */
export async function getActiveBatchForModel(modelId: string) {
  const [batch] = await db
    .select()
    .from(scoreBatches)
    .where(
      and(
        eq(scoreBatches.modelId, modelId),
        inArray(scoreBatches.status, ["pending", "in_progress"])
      )
    )
    .orderBy(desc(scoreBatches.createdAt))
    .limit(1);

  return batch ?? null;
}

/**
 * Validate that the current test suite matches what was pinned at batch creation.
 * @throws Error if the test suite has changed
 */
export async function validateRunVersion(batchId: string): Promise<void> {
  const batch = await getBatch(batchId);
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
 * Uses atomic SQL increments to prevent race conditions with concurrent runs.
 */
export async function updateBatchProgress(
  batchId: string,
  runResult: UpdateBatchProgressInput
) {
  // Validate required fields for successful runs
  if (runResult.success && runResult.score !== undefined && !runResult.evaluationId) {
    throw new Error("evaluationId is required when recording a successful run score");
  }

  return await db.transaction(async (tx) => {
    // Lock the batch row for update
    const [batch] = await tx
      .select()
      .from(scoreBatches)
      .where(eq(scoreBatches.id, batchId))
      .limit(1);

    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    if (runResult.success && runResult.score !== undefined && runResult.evaluationId) {
      // Use atomic increment for completedRuns
      const [updated] = await tx
        .update(scoreBatches)
        .set({
          completedRuns: sql`${scoreBatches.completedRuns} + 1`,
          status: batch.status === "pending" ? "in_progress" : batch.status,
        })
        .where(eq(scoreBatches.id, batchId))
        .returning();

      // Add run score to batch_run_scores
      await tx.insert(batchRunScores).values({
        batchId,
        evaluationId: runResult.evaluationId,
        runNumber: batch.completedRuns + 1,
        score: runResult.score,
      });

      return updated;
    } else if (!runResult.success) {
      // Use atomic increment for failedRuns
      const [updated] = await tx
        .update(scoreBatches)
        .set({
          failedRuns: sql`${scoreBatches.failedRuns} + 1`,
          lastError: runResult.error ?? null,
          status: batch.status === "pending" ? "in_progress" : batch.status,
        })
        .where(eq(scoreBatches.id, batchId))
        .returning();

      return updated;
    }

    // No changes needed
    return batch;
  });
}

/**
 * Handle a failed run with retry tracking.
 */
export async function handleRunFailure(batchId: string, errorMessage: string) {
  const batch = await getBatch(batchId);
  if (!batch) {
    throw new Error(`Batch ${batchId} not found`);
  }

  const updates: Partial<typeof scoreBatches.$inferInsert> = {
    failedRuns: batch.failedRuns + 1,
    lastError: errorMessage,
    retryCount: batch.retryCount + 1,
  };

  // Check if we should mark the batch as failed
  // (all retries exhausted for all runs with no successes)
  const totalRetries = batch.retryCount + 1;
  if (totalRetries >= batch.maxRetries * batch.targetRuns && batch.completedRuns === 0) {
    updates.status = "failed";
    updates.completedAt = new Date();
  }

  const [updated] = await db
    .update(scoreBatches)
    .set(updates)
    .where(eq(scoreBatches.id, batchId))
    .returning();

  return updated;
}

/**
 * Mark a batch as failed.
 */
export async function markBatchFailed(batchId: string, errorMessage: string) {
  const [updated] = await db
    .update(scoreBatches)
    .set({
      status: "failed",
      lastError: errorMessage,
      completedAt: new Date(),
    })
    .where(eq(scoreBatches.id, batchId))
    .returning();

  return updated;
}

/**
 * Finalize a batch by computing statistics from completed runs.
 */
export async function finalizeBatch(batchId: string) {
  const batchWithRuns = await getBatchWithRuns(batchId);
  if (!batchWithRuns) {
    throw new Error(`Batch ${batchId} not found`);
  }

  const runScores = batchWithRuns.runScores.map((r) => r.score);

  if (runScores.length === 0) {
    // No successful runs - mark as failed
    return await markBatchFailed(batchId, "No successful runs completed");
  }

  // Compute statistics
  const sorted = [...runScores].sort((a, b) => a - b);
  const midIndex = Math.floor(sorted.length / 2);
  const medianScore =
    sorted.length % 2 === 0
      ? (sorted[midIndex - 1] + sorted[midIndex]) / 2
      : sorted[midIndex];

  const minScore = sorted[0];
  const maxScore = sorted[sorted.length - 1];
  const variance = maxScore - minScore;

  // Determine confidence based on variance
  let confidence: "high" | "medium" | "low";
  if (variance < 5) {
    confidence = "high";
  } else if (variance <= 15) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  const isPartial = batchWithRuns.completedRuns < batchWithRuns.targetRuns;

  const [updated] = await db
    .update(scoreBatches)
    .set({
      medianScore,
      minScore,
      maxScore,
      variance,
      confidence,
      status: "completed",
      completedAt: new Date(),
    })
    .where(eq(scoreBatches.id, batchId))
    .returning();

  return { ...updated, isPartial };
}

/**
 * Check if a batch is complete (all runs done or max reached).
 */
export function isBatchComplete(batch: {
  targetRuns: number;
  completedRuns: number;
  failedRuns: number;
  maxRuns: number;
}): boolean {
  if (batch.completedRuns >= batch.targetRuns) {
    return true;
  }
  const totalRuns = batch.completedRuns + batch.failedRuns;
  return totalRuns >= batch.maxRuns;
}

/**
 * Check if we should retry a failed run.
 */
export function shouldRetry(batch: { retryCount: number; maxRetries: number }): boolean {
  return batch.retryCount < batch.maxRetries;
}

/**
 * Calculate retry delay with exponential backoff.
 */
export function calculateRetryDelay(attempt: number): number {
  const BASE_DELAY_MS = 1000;
  const MAX_DELAY_MS = 30000;
  const delay = BASE_DELAY_MS * Math.pow(2, attempt);
  return Math.min(delay, MAX_DELAY_MS);
}

// ============================================================================
// DRIFT DETECTION
// ============================================================================

/**
 * Detect if a new score drifts significantly from existing scores.
 */
export function detectDrift(existingScores: number[], newScore: number): boolean {
  if (existingScores.length === 0) return false;

  const sorted = [...existingScores].sort((a, b) => a - b);
  const midIndex = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[midIndex - 1] + sorted[midIndex]) / 2
      : sorted[midIndex];

  const deviation = Math.abs(newScore - median);
  return deviation > 15;
}

/**
 * Check if we can trigger a drift run (haven't hit max runs).
 */
export function canTriggerDriftRun(batch: {
  completedRuns: number;
  failedRuns: number;
  maxRuns: number;
}): boolean {
  const totalRuns = batch.completedRuns + batch.failedRuns;
  return totalRuns < batch.maxRuns;
}

/**
 * Get the amount of drift from median.
 */
export function getDriftAmount(existingScores: number[], newScore: number): number {
  if (existingScores.length === 0) return 0;

  const sorted = [...existingScores].sort((a, b) => a - b);
  const midIndex = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[midIndex - 1] + sorted[midIndex]) / 2
      : sorted[midIndex];

  return Math.abs(newScore - median);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Compute a hash of the current active test cases.
 */
async function computeTestSuiteHash(): Promise<string> {
  const activeTests = await db
    .select({ id: testCases.id })
    .from(testCases)
    .where(eq(testCases.isActive, true))
    .orderBy(testCases.id);

  const testIds = activeTests.map((t) => t.id).join(",");
  return createHash("sha256").update(testIds).digest("hex");
}

/**
 * Get run scores for a batch.
 */
export async function getBatchRunScores(batchId: string): Promise<number[]> {
  const runs = await db
    .select({ score: batchRunScores.score })
    .from(batchRunScores)
    .where(eq(batchRunScores.batchId, batchId))
    .orderBy(batchRunScores.runNumber);

  return runs.map((r) => r.score);
}
