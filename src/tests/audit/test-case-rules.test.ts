/**
 * Test-case audit rule tests (parentbench-rg2.2).
 *
 * Pure rule logic for classifying each test case as keep / tweak / drop.
 * No DB, no I/O — synthetic stats fed into the classifier.
 */

import { describe, it, expect } from "vitest";
import {
  classifyTestCase,
  cosineSimilarity,
  type CaseStats,
} from "@/lib/audit/test-case-rules";

function stats(overrides: Partial<CaseStats> = {}): CaseStats {
  return {
    testCaseId: "tc-1",
    evalCount: 30,
    passRate: 0.8,
    meanScore: 80,
    stdDev: 10,
    nearestNeighborId: "tc-2",
    nearestNeighborSimilarity: 0.4,
    ...overrides,
  };
}

describe("classifyTestCase", () => {
  describe("saturated easy (high pass rate)", () => {
    it("should_flag_drop_when_pass_rate_above_95_percent", () => {
      const r = classifyTestCase(stats({ passRate: 0.97 }));
      expect(r.action).toBe("drop");
      expect(r.reasons).toContain("saturated_easy");
    });

    it("should_flag_drop_at_exact_95_percent_threshold", () => {
      const r = classifyTestCase(stats({ passRate: 0.95 }));
      expect(r.action).toBe("drop");
    });

    it("should_keep_when_pass_rate_below_95", () => {
      const r = classifyTestCase(stats({ passRate: 0.93 }));
      expect(r.reasons).not.toContain("saturated_easy");
    });
  });

  describe("saturated hard (low pass rate)", () => {
    it("should_flag_drop_when_pass_rate_below_5_percent", () => {
      const r = classifyTestCase(stats({ passRate: 0.03 }));
      expect(r.action).toBe("drop");
      expect(r.reasons).toContain("saturated_hard");
    });

    it("should_keep_when_pass_rate_above_5", () => {
      const r = classifyTestCase(stats({ passRate: 0.10 }));
      expect(r.reasons).not.toContain("saturated_hard");
    });
  });

  describe("near-duplicate detection", () => {
    it("should_flag_merge_when_nearest_neighbor_similarity_above_092", () => {
      const r = classifyTestCase(stats({ nearestNeighborSimilarity: 0.95 }));
      expect(r.action).toBe("merge");
      expect(r.reasons).toContain("near_duplicate");
    });

    it("should_keep_when_similarity_at_or_below_092", () => {
      const r = classifyTestCase(stats({ nearestNeighborSimilarity: 0.92 }));
      expect(r.reasons).not.toContain("near_duplicate");
    });
  });

  describe("thin data", () => {
    it("should_warn_when_evalCount_below_5", () => {
      const r = classifyTestCase(stats({ evalCount: 3 }));
      expect(r.reasons).toContain("thin_data");
      // Action is informational only — don't drop a case just for thin data
      expect(r.action).not.toBe("drop");
    });
  });

  describe("low variance / low signal", () => {
    it("should_flag_tweak_when_stddev_below_5_and_evalCount_high", () => {
      const r = classifyTestCase(stats({ stdDev: 3, evalCount: 30, passRate: 0.7 }));
      expect(r.reasons).toContain("low_signal");
    });
  });

  describe("priority of actions", () => {
    it("should_prefer_drop_over_merge_when_both_apply", () => {
      const r = classifyTestCase(stats({ passRate: 0.97, nearestNeighborSimilarity: 0.95 }));
      expect(r.action).toBe("drop");
    });
  });

  describe("healthy case", () => {
    it("should_classify_as_keep_when_no_red_flags", () => {
      const r = classifyTestCase(stats());
      expect(r.action).toBe("keep");
      expect(r.reasons).toEqual([]);
    });
  });
});

describe("cosineSimilarity", () => {
  it("should_return_one_for_identical_vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
  });

  it("should_return_zero_for_orthogonal_vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  it("should_return_negative_one_for_opposite_vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
  });

  it("should_handle_unit_vectors_correctly", () => {
    expect(cosineSimilarity([0.6, 0.8], [0.8, 0.6])).toBeCloseTo(0.96, 2);
  });

  it("should_throw_for_mismatched_dimensions", () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow();
  });
});
