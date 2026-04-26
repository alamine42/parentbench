/**
 * Capability coverage tests (parentbench-rg1.1).
 *
 * Pure logic that takes a flat list of (modelId, benchmark) live entries
 * and returns a per-model coverage summary used by the admin page
 * ("N of 3 benchmarks present").
 */

import { describe, it, expect } from "vitest";
import {
  computeCoverage,
  selectLiveScores,
  type CapabilityScoreRow,
} from "@/lib/capability/coverage";

function row(over: Partial<CapabilityScoreRow>): CapabilityScoreRow {
  return {
    id: `row-${Math.random().toString(36).slice(2, 9)}`,
    modelId: "m-1",
    benchmark: "mmlu",
    score: 70,
    recordedAt: new Date("2026-01-01"),
    supersededAt: null,
    ...over,
  };
}

describe("selectLiveScores", () => {
  it("should_return_only_unsuperseded_rows", () => {
    const rows = [
      row({ id: "a", modelId: "m-1", benchmark: "mmlu", supersededAt: new Date("2026-02-01") }),
      row({ id: "b", modelId: "m-1", benchmark: "mmlu", supersededAt: null }),
    ];
    const live = selectLiveScores(rows);
    expect(live.map((r) => r.id)).toEqual(["b"]);
  });

  it("should_keep_one_live_row_per_model_benchmark_pair", () => {
    const rows = [
      row({ id: "a", modelId: "m-1", benchmark: "mmlu", supersededAt: null }),
      row({ id: "b", modelId: "m-1", benchmark: "aime_2025", supersededAt: null }),
      row({ id: "c", modelId: "m-2", benchmark: "mmlu", supersededAt: null }),
    ];
    const live = selectLiveScores(rows);
    expect(live).toHaveLength(3);
  });

  it("should_return_empty_when_all_rows_are_superseded", () => {
    const rows = [
      row({ supersededAt: new Date() }),
      row({ supersededAt: new Date() }),
    ];
    expect(selectLiveScores(rows)).toEqual([]);
  });
});

describe("computeCoverage", () => {
  it("should_report_zero_of_three_when_model_has_no_live_scores", () => {
    const rows: CapabilityScoreRow[] = [];
    const cov = computeCoverage(["m-1"], rows);
    expect(cov.get("m-1")).toEqual({ present: [], missing: ["mmlu", "gpqa", "aime_2025"], count: 0, total: 3 });
  });

  it("should_report_three_of_three_when_all_benchmarks_present", () => {
    const rows = [
      row({ modelId: "m-1", benchmark: "mmlu" }),
      row({ modelId: "m-1", benchmark: "aime_2025" }),
      row({ modelId: "m-1", benchmark: "gpqa" }),
    ];
    const cov = computeCoverage(["m-1"], rows);
    expect(cov.get("m-1")?.count).toBe(3);
  });

  it("should_only_count_unsuperseded_rows", () => {
    const rows = [
      row({ modelId: "m-1", benchmark: "mmlu", supersededAt: new Date() }),
      row({ modelId: "m-1", benchmark: "aime_2025" }),
    ];
    const cov = computeCoverage(["m-1"], rows);
    expect(cov.get("m-1")?.count).toBe(1);
    expect(cov.get("m-1")?.present).toEqual(["aime_2025"]);
  });

  it("should_include_models_with_no_scores_in_the_output", () => {
    const cov = computeCoverage(["m-1", "m-2"], []);
    expect(cov.has("m-1")).toBe(true);
    expect(cov.has("m-2")).toBe(true);
  });

  it("should_mark_model_eligible_when_count_is_two_or_more", () => {
    const rows = [
      row({ modelId: "m-1", benchmark: "mmlu" }),
      row({ modelId: "m-1", benchmark: "aime_2025" }),
    ];
    const cov = computeCoverage(["m-1"], rows);
    expect(cov.get("m-1")?.count).toBe(2);
    // Eligible flag is implicit at >= 2; no separate field, just count
  });
});
