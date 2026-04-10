/**
 * Statistical Robustness Test Utilities
 *
 * Shared test data generators and mock factories.
 */

import { vi, expect } from "vitest";

// ============================================================================
// TEST DATA GENERATORS
// ============================================================================

export function generateScoreBatch(overrides?: Partial<{
  id: string;
  modelId: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  targetRuns: number;
  completedRuns: number;
  failedRuns: number;
  maxRuns: number;
  methodologyVersion: string;
  testSuiteHash: string;
}>) {
  return {
    id: overrides?.id ?? `batch-${Math.random().toString(36).substring(7)}`,
    modelId: overrides?.modelId ?? "model-123",
    status: overrides?.status ?? "pending",
    targetRuns: overrides?.targetRuns ?? 3,
    completedRuns: overrides?.completedRuns ?? 0,
    failedRuns: overrides?.failedRuns ?? 0,
    maxRuns: overrides?.maxRuns ?? 5,
    methodologyVersion: overrides?.methodologyVersion ?? "2026-04-01",
    testSuiteHash: overrides?.testSuiteHash ?? "abc123def456",
    medianScore: null,
    minScore: null,
    maxScore: null,
    variance: null,
    confidence: null,
    lastError: null,
    retryCount: 0,
    triggeredBy: "manual",
    createdAt: new Date(),
    completedAt: null,
  };
}

export function generateEvaluationRun(overrides?: Partial<{
  id: string;
  scoreBatchId: string;
  runNumber: number;
  overallScore: number;
  status: "pending" | "running" | "completed" | "failed";
}>) {
  return {
    id: overrides?.id ?? `eval-${Math.random().toString(36).substring(7)}`,
    scoreBatchId: overrides?.scoreBatchId ?? "batch-123",
    runNumber: overrides?.runNumber ?? 1,
    modelId: "model-123",
    status: overrides?.status ?? "completed",
    overallScore: overrides?.overallScore ?? 80,
    triggeredBy: "scheduled",
    startedAt: new Date(),
    completedAt: new Date(),
    totalTestCases: 51,
    completedTestCases: 51,
    failedTestCases: 0,
    errorMessage: null,
    createdAt: new Date(),
  };
}

export function generateScore(overrides?: Partial<{
  id: string;
  modelId: string;
  overallScore: number;
  confidence: "high" | "medium" | "low" | "legacy" | null;
  variance: number | null;
  scoreBatchId: string | null;
}>) {
  return {
    id: overrides?.id ?? `score-${Math.random().toString(36).substring(7)}`,
    modelId: overrides?.modelId ?? "model-123",
    overallScore: overrides?.overallScore ?? 85,
    overallGrade: "B+" as const,
    trend: "stable" as const,
    dataQuality: "verified" as const,
    confidence: overrides?.confidence ?? "high",
    variance: overrides?.variance ?? 3,
    scoreBatchId: overrides?.scoreBatchId ?? "batch-123",
    categoryScores: [
      { category: "age_inappropriate_content", score: 88, grade: "B+", passRate: 0.9, testCount: 15 },
      { category: "manipulation_resistance", score: 82, grade: "B", passRate: 0.85, testCount: 12 },
      { category: "data_privacy_minors", score: 85, grade: "B+", passRate: 0.88, testCount: 12 },
      { category: "parental_controls_respect", score: 84, grade: "B", passRate: 0.86, testCount: 12 },
    ],
    evaluationId: "eval-123",
    computedAt: new Date(),
  };
}

// ============================================================================
// MOCK FACTORIES
// ============================================================================

/**
 * Create a mock database for score batches
 */
export function createMockBatchStore() {
  const batches = new Map<string, ReturnType<typeof generateScoreBatch>>();
  const runs = new Map<string, ReturnType<typeof generateEvaluationRun>[]>();

  return {
    batches,
    runs,

    async createBatch(data: Partial<ReturnType<typeof generateScoreBatch>>) {
      const batch = generateScoreBatch(data);
      batches.set(batch.id, batch);
      runs.set(batch.id, []);
      return batch;
    },

    async getBatch(id: string) {
      return batches.get(id) ?? null;
    },

    async updateBatch(id: string, updates: Partial<ReturnType<typeof generateScoreBatch>>) {
      const batch = batches.get(id);
      if (!batch) throw new Error(`Batch ${id} not found`);
      const updated = { ...batch, ...updates };
      batches.set(id, updated);
      return updated;
    },

    async addRun(batchId: string, run: ReturnType<typeof generateEvaluationRun>) {
      const batchRuns = runs.get(batchId) ?? [];
      batchRuns.push(run);
      runs.set(batchId, batchRuns);
      return run;
    },

    async getRuns(batchId: string) {
      return runs.get(batchId) ?? [];
    },

    clear() {
      batches.clear();
      runs.clear();
    },
  };
}

/**
 * Create a mock Inngest client for testing event sending
 */
export function createMockInngest() {
  const sentEvents: Array<{ name: string; data: unknown }> = [];

  return {
    sentEvents,

    send: vi.fn().mockImplementation(async (event: { name: string; data: unknown }) => {
      sentEvents.push(event);
      return { ids: [`event-${sentEvents.length}`] };
    }),

    getSentEvents(name?: string) {
      if (name) {
        return sentEvents.filter(e => e.name === name);
      }
      return sentEvents;
    },

    clear() {
      sentEvents.length = 0;
    },
  };
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Assert that a batch has expected statistics
 */
export function expectBatchStats(
  batch: ReturnType<typeof generateScoreBatch>,
  expected: {
    medianScore?: number;
    variance?: number;
    confidence?: "high" | "medium" | "low";
  }
) {
  if (expected.medianScore !== undefined) {
    expect(batch.medianScore).toBe(expected.medianScore);
  }
  if (expected.variance !== undefined) {
    expect(batch.variance).toBe(expected.variance);
  }
  if (expected.confidence !== undefined) {
    expect(batch.confidence).toBe(expected.confidence);
  }
}

/**
 * Assert that confidence matches variance threshold
 */
export function expectConfidenceMatchesVariance(variance: number, confidence: string) {
  if (variance < 5) {
    expect(confidence).toBe("high");
  } else if (variance <= 15) {
    expect(confidence).toBe("medium");
  } else {
    expect(confidence).toBe("low");
  }
}
