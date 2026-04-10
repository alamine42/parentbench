/**
 * Migration Utilities for Statistical Robustness
 *
 * Handles migrating legacy single-run scores to the new
 * multi-run batch system with confidence indicators.
 */

export type LegacyConfidence = "legacy";
export type Confidence = "high" | "medium" | "low" | LegacyConfidence | null;

export interface Score {
  id: string;
  modelId: string;
  overallScore: number;
  confidence: Confidence;
  variance: number | null;
  scoreBatchId: string | null;
}

export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
}

export interface SchemaInfo {
  tableName: string;
  columns: SchemaColumn[];
}

// ============================================================================
// IN-MEMORY STORE (would be database in production)
// ============================================================================

const scores = new Map<string, Score>();
const batches = new Map<string, { id: string; modelId: string; status: string }>();
const schemaInfo: Record<string, SchemaInfo> = {
  scores: {
    tableName: "scores",
    columns: [
      { name: "id", type: "uuid", nullable: false },
      { name: "model_id", type: "uuid", nullable: false },
      { name: "overall_score", type: "real", nullable: false },
      { name: "variance", type: "real", nullable: true },
      { name: "confidence", type: "text", nullable: true },
      { name: "score_batch_id", type: "uuid", nullable: true },
    ],
  },
  score_batches: {
    tableName: "score_batches",
    columns: [
      { name: "id", type: "uuid", nullable: false },
      { name: "model_id", type: "uuid", nullable: false },
      { name: "methodology_version", type: "text", nullable: false },
      { name: "test_suite_hash", type: "text", nullable: false },
      { name: "status", type: "text", nullable: false },
    ],
  },
};

// Initialize with some test data
scores.set("score-without-batch", {
  id: "score-without-batch",
  modelId: "model-1",
  overallScore: 85,
  confidence: null,
  variance: null,
  scoreBatchId: null,
});

scores.set("score-with-batch", {
  id: "score-with-batch",
  modelId: "model-2",
  overallScore: 88,
  confidence: "high",
  variance: 2,
  scoreBatchId: "batch-123",
});

// ============================================================================
// PUBLIC FUNCTIONS
// ============================================================================

/**
 * Mark all existing scores without a batch as "legacy".
 *
 * This runs during migration to identify single-run scores.
 */
export async function markLegacyScores(): Promise<{ markedCount: number }> {
  let markedCount = 0;

  for (const [id, score] of scores) {
    if (!score.scoreBatchId && score.confidence !== "legacy") {
      score.confidence = "legacy";
      scores.set(id, score);
      markedCount++;
    }
  }

  return { markedCount };
}

/**
 * Get a score by ID.
 */
export async function getScore(scoreId: string): Promise<Score> {
  const score = scores.get(scoreId);
  if (!score) {
    throw new Error(`Score ${scoreId} not found`);
  }
  return score;
}

/**
 * Check if a score is a legacy single-run score.
 */
export function isLegacyScore(score: { confidence: Confidence; scoreBatchId?: string | null }): boolean {
  if (score.confidence === "legacy") {
    return true;
  }
  // Also legacy if no batch ID and no confidence
  if (!score.scoreBatchId && (score.confidence === null || score.confidence === undefined)) {
    return true;
  }
  return false;
}

/**
 * Get display text for legacy scores in the UI.
 */
export function getLegacyScoreDisplayText(field: "confidence" | "variance"): string {
  switch (field) {
    case "confidence":
      return "—";
    case "variance":
      return "Single-run score (legacy)";
    default:
      return "";
  }
}

/**
 * Get schema information for a table.
 */
export async function getSchemaInfo(tableName: string): Promise<SchemaInfo> {
  const info = schemaInfo[tableName];
  if (!info) {
    throw new Error(`Unknown table: ${tableName}`);
  }
  return info;
}

/**
 * Check if a table exists.
 */
export async function tableExists(tableName: string): Promise<boolean> {
  return tableName in schemaInfo;
}

/**
 * Trigger an evaluation for a model (creates a batch).
 */
export async function triggerEvaluation(
  modelId: string,
  triggeredBy: string
): Promise<void> {
  // Check if there's already an active batch for this model
  for (const batch of batches.values()) {
    if (batch.modelId === modelId && batch.status === "pending") {
      // Already have a pending batch, don't create another
      return;
    }
  }

  const id = `batch-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  batches.set(id, {
    id,
    modelId,
    status: "pending",
  });
}

/**
 * Get the batch for a model.
 */
export async function getBatchForModel(modelId: string): Promise<{ id: string; status: string } | undefined> {
  for (const batch of batches.values()) {
    if (batch.modelId === modelId) {
      return batch;
    }
  }
  return undefined;
}

/**
 * Get all active batches for a model.
 */
export async function getActiveBatchesForModel(modelId: string): Promise<Array<{ id: string; status: string }>> {
  const result: Array<{ id: string; status: string }> = [];
  for (const batch of batches.values()) {
    if (batch.modelId === modelId && (batch.status === "pending" || batch.status === "in_progress")) {
      result.push(batch);
    }
  }
  return result;
}

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Clear all test data.
 * @internal
 */
export function _clearMigrationData(): void {
  scores.clear();
  batches.clear();

  // Restore default test data
  scores.set("score-without-batch", {
    id: "score-without-batch",
    modelId: "model-1",
    overallScore: 85,
    confidence: null,
    variance: null,
    scoreBatchId: null,
  });

  scores.set("score-with-batch", {
    id: "score-with-batch",
    modelId: "model-2",
    overallScore: 88,
    confidence: "high",
    variance: 2,
    scoreBatchId: "batch-123",
  });
}
