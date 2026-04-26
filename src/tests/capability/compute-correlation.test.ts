/**
 * Correlation orchestrator tests (parentbench-rg1.2).
 *
 * Pure orchestrator: takes already-loaded capability rows + ParentBench
 * scores and produces the row to insert into correlation_reports. DB I/O
 * is split out so this stays unit-testable.
 */

import { describe, it, expect } from "vitest";
import {
  computeCorrelationReport,
  MIN_MODELS_FOR_REPORT,
} from "@/lib/capability/compute-correlation";
import type { LiveCapabilityScore } from "@/lib/capability/build-capability-score";

const cap = (modelId: string, benchmark: "mmlu" | "aime_2025" | "gpqa", score: number): LiveCapabilityScore => ({
  modelId,
  benchmark,
  score,
});

const pb = (modelId: string, slug: string, score: number) => ({ modelId, modelSlug: slug, overallScore: score });

describe("computeCorrelationReport", () => {
  it("O1_should_return_insufficient_data_when_fewer_than_five_eligible_models", () => {
    const capabilityRows = [
      cap("m1", "mmlu", 70), cap("m1", "aime_2025", 80),
      cap("m2", "mmlu", 60), cap("m2", "aime_2025", 70),
    ];
    const parentBenchScores = [pb("m1", "model-a", 90), pb("m2", "model-b", 80)];
    const result = computeCorrelationReport({
      capabilityRows,
      parentBenchScores,
      methodologyVersion: "1.2.0",
    });
    expect(result.outcome).toBe("insufficient_data");
  });

  it("O2_should_return_a_report_when_eligible_models_meet_the_floor", () => {
    const slugs = ["a", "b", "c", "d", "e"];
    const capabilityRows: LiveCapabilityScore[] = [];
    const parentBenchScores: Array<{ modelId: string; modelSlug: string; overallScore: number }> = [];
    slugs.forEach((slug, i) => {
      const id = `m-${slug}`;
      capabilityRows.push(cap(id, "mmlu", 50 + i * 10));
      capabilityRows.push(cap(id, "aime_2025", 40 + i * 12));
      parentBenchScores.push(pb(id, slug, 70 + i * 4));
    });
    const result = computeCorrelationReport({
      capabilityRows,
      parentBenchScores,
      methodologyVersion: "1.2.0",
    });
    expect(result.outcome).toBe("ok");
    if (result.outcome === "ok") {
      expect(result.report.modelCount).toBe(MIN_MODELS_FOR_REPORT);
      expect(result.report.spearmanRho).toBeDefined();
      expect(result.report.spearmanRhoAbs).toBeGreaterThanOrEqual(0);
      expect(result.report.spearmanRhoAbs).toBeLessThanOrEqual(1);
    }
  });

  it("O3_should_be_deterministic_for_identical_inputs", () => {
    const slugs = ["a", "b", "c", "d", "e", "f"];
    const capabilityRows: LiveCapabilityScore[] = [];
    const parentBenchScores: Array<{ modelId: string; modelSlug: string; overallScore: number }> = [];
    slugs.forEach((slug, i) => {
      const id = `m-${slug}`;
      capabilityRows.push(cap(id, "mmlu", 50 + i * 7));
      capabilityRows.push(cap(id, "aime_2025", 40 + i * 9));
      parentBenchScores.push(pb(id, slug, 60 + i * 3));
    });
    const r1 = computeCorrelationReport({
      capabilityRows, parentBenchScores, methodologyVersion: "1.2.0",
    });
    const r2 = computeCorrelationReport({
      capabilityRows, parentBenchScores, methodologyVersion: "1.2.0",
    });
    expect(r1).toEqual(r2);
  });

  it("O4_should_only_include_models_with_both_capability_and_parentbench_scores", () => {
    // 5 models with capability data, but only 4 with ParentBench scores.
    const capabilityRows: LiveCapabilityScore[] = [];
    const parentBenchScores: Array<{ modelId: string; modelSlug: string; overallScore: number }> = [];
    for (let i = 0; i < 5; i++) {
      const id = `m-${i}`;
      capabilityRows.push(cap(id, "mmlu", 50 + i * 10));
      capabilityRows.push(cap(id, "aime_2025", 40 + i * 12));
      if (i < 4) parentBenchScores.push(pb(id, `slug-${i}`, 70 + i * 4));
    }
    const result = computeCorrelationReport({
      capabilityRows, parentBenchScores, methodologyVersion: "1.2.0",
    });
    expect(result.outcome).toBe("insufficient_data");
    if (result.outcome === "insufficient_data") {
      expect(result.eligibleCount).toBe(4); // 4 had both → still under the 5-floor
    }
  });
});
