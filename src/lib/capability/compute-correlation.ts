/**
 * Correlation orchestrator (parentbench-rg1.2).
 *
 * Pure function that ties the data layer (capability rows + ParentBench
 * scores) to the report shape ready for insertion into
 * correlation_reports. DB I/O lives in the Inngest function so this
 * stays unit-testable.
 */

import { spearmanRank } from "./spearman";
import { buildCapabilityScores, type LiveCapabilityScore } from "./build-capability-score";

export const MIN_MODELS_FOR_REPORT = 5;

export type ParentBenchScoreInput = {
  modelId: string;
  modelSlug: string;
  overallScore: number;
};

export type ComputeCorrelationInput = {
  capabilityRows: LiveCapabilityScore[];
  parentBenchScores: ParentBenchScoreInput[];
  methodologyVersion: string;
};

export type ReportPayload = {
  spearmanRho: number;
  spearmanRhoAbs: number;
  modelCount: number;
  benchmarksUsed: string[];
  perModelScores: Array<{
    modelSlug: string;
    parentBenchScore: number;
    capabilityScore: number;
  }>;
  methodologyVersion: string;
};

export type ComputeCorrelationResult =
  | { outcome: "ok"; report: ReportPayload }
  | { outcome: "insufficient_data"; eligibleCount: number; reason: string };

export function computeCorrelationReport(
  input: ComputeCorrelationInput
): ComputeCorrelationResult {
  // Build per-model capability score (z-score average; ≥2 benchmarks gate)
  const capabilityByModel = buildCapabilityScores(input.capabilityRows);

  // Pair eligible models with their ParentBench score
  const pbByModel = new Map(input.parentBenchScores.map((p) => [p.modelId, p]));
  const paired: Array<{ modelSlug: string; capabilityScore: number; parentBenchScore: number }> = [];
  for (const [modelId, capScore] of capabilityByModel) {
    const pb = pbByModel.get(modelId);
    if (!pb) continue;
    paired.push({
      modelSlug: pb.modelSlug,
      capabilityScore: capScore,
      parentBenchScore: pb.overallScore,
    });
  }

  // Sort by slug so deterministic ordering enters the report
  paired.sort((a, b) => a.modelSlug.localeCompare(b.modelSlug));

  if (paired.length < MIN_MODELS_FOR_REPORT) {
    return {
      outcome: "insufficient_data",
      eligibleCount: paired.length,
      reason: `Only ${paired.length} models have both a capability score (≥2 benchmarks) and a ParentBench score; need ≥${MIN_MODELS_FOR_REPORT}.`,
    };
  }

  const pbVec = paired.map((p) => p.parentBenchScore);
  const capVec = paired.map((p) => p.capabilityScore);
  const rho = spearmanRank(pbVec, capVec);

  const benchmarksUsed = [...new Set(input.capabilityRows.map((r) => r.benchmark))].sort();

  return {
    outcome: "ok",
    report: {
      spearmanRho: round3(rho),
      spearmanRhoAbs: round3(Math.abs(rho)),
      modelCount: paired.length,
      benchmarksUsed,
      perModelScores: paired.map((p) => ({
        modelSlug: p.modelSlug,
        parentBenchScore: p.parentBenchScore,
        capabilityScore: round3(p.capabilityScore),
      })),
      methodologyVersion: input.methodologyVersion,
    },
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
