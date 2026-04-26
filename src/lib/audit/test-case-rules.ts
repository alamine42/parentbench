/**
 * Test-case audit rules (parentbench-rg2.2).
 *
 * Pure logic for classifying each test case as keep / tweak / merge / drop
 * based on per-case statistics computed from historical eval results.
 *
 * The thresholds are deliberately tunable — the audit script supplies
 * these stats and the classifier emits an action recommendation that a
 * human reviews before any test-cases.json edits.
 */

const SATURATED_EASY_THRESHOLD = 0.95;
const SATURATED_HARD_THRESHOLD = 0.05;
const NEAR_DUPLICATE_THRESHOLD = 0.92; // strict >, equal is fine
const LOW_SIGNAL_STDDEV = 5;
const LOW_SIGNAL_MIN_EVAL_COUNT = 20; // don't claim "low signal" with thin data
const THIN_DATA_THRESHOLD = 5;

export type CaseAction = "keep" | "tweak" | "merge" | "drop";

export type CaseClassification = {
  action: CaseAction;
  reasons: CaseReason[];
};

export type CaseReason =
  | "saturated_easy"      // pass rate ≥ 95%
  | "saturated_hard"      // pass rate ≤ 5%
  | "near_duplicate"      // cosine > threshold to another case
  | "low_signal"          // tight score distribution → little discrimination
  | "thin_data";          // few historical evals — not enough to judge

export type CaseStats = {
  testCaseId: string;
  evalCount: number;
  passRate: number;        // 0..1
  meanScore: number;       // 0..100
  stdDev: number;          // 0..50ish
  nearestNeighborId: string | null;
  nearestNeighborSimilarity: number; // 0..1, or 0 if no neighbor
};

// ============================================================================
// CLASSIFIER
// ============================================================================

export function classifyTestCase(s: CaseStats): CaseClassification {
  const reasons: CaseReason[] = [];

  if (s.passRate >= SATURATED_EASY_THRESHOLD) reasons.push("saturated_easy");
  if (s.passRate <= SATURATED_HARD_THRESHOLD) reasons.push("saturated_hard");
  if (s.nearestNeighborSimilarity > NEAR_DUPLICATE_THRESHOLD) reasons.push("near_duplicate");
  if (s.evalCount < THIN_DATA_THRESHOLD) reasons.push("thin_data");
  if (s.stdDev < LOW_SIGNAL_STDDEV && s.evalCount >= LOW_SIGNAL_MIN_EVAL_COUNT) {
    reasons.push("low_signal");
  }

  // Priority: drop > merge > tweak > keep
  if (reasons.includes("saturated_easy") || reasons.includes("saturated_hard")) {
    return { action: "drop", reasons };
  }
  if (reasons.includes("near_duplicate")) {
    return { action: "merge", reasons };
  }
  if (reasons.includes("low_signal")) {
    return { action: "tweak", reasons };
  }
  return { action: "keep", reasons };
}

// ============================================================================
// COSINE SIMILARITY
// ============================================================================

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`cosineSimilarity: dimension mismatch (${a.length} vs ${b.length})`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
