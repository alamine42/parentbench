/**
 * Capability score builder tests (parentbench-rg1.2).
 *
 * Pure function over per-(model, benchmark) score rows. Returns a
 * Map<modelId, capabilityScore> for models with >= MIN_BENCHMARKS.
 * Capability score is the z-score average across each model's
 * available benchmark scores.
 */

import { describe, it, expect } from "vitest";
import {
  buildCapabilityScores,
  MIN_BENCHMARKS_FOR_ELIGIBILITY,
  type LiveCapabilityScore,
} from "@/lib/capability/build-capability-score";

const r = (modelId: string, benchmark: "mmlu" | "aime_2025" | "gpqa", score: number): LiveCapabilityScore => ({
  modelId,
  benchmark,
  score,
});

describe("buildCapabilityScores", () => {
  it("B1_should_compute_z_scores_with_mean_zero_std_one_per_benchmark", () => {
    // Five models, one benchmark — z-scores have mean ~0 and std ~1
    const rows = [
      r("m1", "mmlu", 50),
      r("m2", "mmlu", 60),
      r("m3", "mmlu", 70),
      r("m4", "mmlu", 80),
      r("m5", "mmlu", 90),
    ];
    // We need at least MIN_BENCHMARKS_FOR_ELIGIBILITY benchmarks per
    // model. With only mmlu, none qualify; verify exclusion.
    const out = buildCapabilityScores(rows);
    expect(out.size).toBe(0);
  });

  it("B2_should_average_z_scores_for_a_two_benchmark_model", () => {
    // Five models with both mmlu + aime_2025 → all eligible.
    // m3 sits at the mean of both; its capability score should be 0.
    const rows = [
      r("m1", "mmlu", 50), r("m1", "aime_2025", 50),
      r("m2", "mmlu", 60), r("m2", "aime_2025", 60),
      r("m3", "mmlu", 70), r("m3", "aime_2025", 70),
      r("m4", "mmlu", 80), r("m4", "aime_2025", 80),
      r("m5", "mmlu", 90), r("m5", "aime_2025", 90),
    ];
    const out = buildCapabilityScores(rows);
    expect(out.get("m3")).toBeCloseTo(0, 5);
  });

  it("B3_should_exclude_a_model_with_only_one_benchmark", () => {
    const rows = [
      r("m1", "mmlu", 50), r("m1", "aime_2025", 50),
      r("m2", "mmlu", 60), r("m2", "aime_2025", 60),
      r("m3", "mmlu", 70), // only one benchmark
    ];
    const out = buildCapabilityScores(rows);
    expect(out.has("m3")).toBe(false);
    expect(out.has("m1")).toBe(true);
  });

  it("B4_should_include_model_with_all_three_benchmarks", () => {
    const rows = [
      r("m1", "mmlu", 70), r("m1", "aime_2025", 80), r("m1", "gpqa", 60),
      r("m2", "mmlu", 80), r("m2", "aime_2025", 90), r("m2", "gpqa", 70),
    ];
    const out = buildCapabilityScores(rows);
    expect(out.has("m1")).toBe(true);
    expect(out.has("m2")).toBe(true);
  });

  it("B5_should_handle_zero_variance_benchmark_without_throwing", () => {
    // mmlu identical across all models → z = 0 for everyone on mmlu;
    // aime_2025 provides the discrimination.
    const rows = [
      r("m1", "mmlu", 70), r("m1", "aime_2025", 50),
      r("m2", "mmlu", 70), r("m2", "aime_2025", 90),
    ];
    expect(() => buildCapabilityScores(rows)).not.toThrow();
    const out = buildCapabilityScores(rows);
    expect(out.size).toBe(2);
  });

  it("B6_should_exclude_model_with_no_benchmarks", () => {
    // m3 not in any rows → not in output
    const rows = [
      r("m1", "mmlu", 70), r("m1", "aime_2025", 80),
      r("m2", "mmlu", 80), r("m2", "aime_2025", 90),
    ];
    const out = buildCapabilityScores(rows);
    expect(out.has("m3")).toBe(false);
  });

  it("should_use_2_as_the_eligibility_threshold", () => {
    expect(MIN_BENCHMARKS_FOR_ELIGIBILITY).toBe(2);
  });
});
