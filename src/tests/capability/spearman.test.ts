/**
 * Spearman rank correlation tests (parentbench-rg1.2).
 *
 * Pure function — no I/O. Implementation: rank both vectors with
 * average-rank tie-breaking, then Pearson correlation on the ranks.
 */

import { describe, it, expect } from "vitest";
import { spearmanRank } from "@/lib/capability/spearman";

describe("spearmanRank", () => {
  it("S1_should_return_one_for_identical_vectors", () => {
    expect(spearmanRank([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
  });

  it("S2_should_return_negative_one_for_opposite_vectors", () => {
    expect(spearmanRank([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 5);
  });

  it("S3_should_return_value_in_range_for_independent_random", () => {
    const a = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const b = [73, 12, 91, 5, 64, 38, 49, 22, 80, 17];
    const r = spearmanRank(a, b);
    expect(r).toBeGreaterThanOrEqual(-1);
    expect(r).toBeLessThanOrEqual(1);
  });

  it("S4_should_handle_ties_with_average_rank", () => {
    // a=[1,2,2,3], b=[1,2,3,4]
    // ranks(a) = [1, 2.5, 2.5, 4]
    // ranks(b) = [1, 2, 3, 4]
    // Hand-computed Pearson on these two rank vectors ≈ 0.9487
    const r = spearmanRank([1, 2, 2, 3], [1, 2, 3, 4]);
    expect(r).toBeCloseTo(0.9487, 3);
  });

  it("S5_should_handle_minimum_n_three_without_throwing", () => {
    expect(() => spearmanRank([1, 2, 3], [1, 2, 3])).not.toThrow();
  });

  it("S6_should_throw_when_n_below_two", () => {
    expect(() => spearmanRank([1], [1])).toThrow();
  });

  it("S7_should_throw_on_mismatched_lengths", () => {
    expect(() => spearmanRank([1, 2], [1, 2, 3])).toThrow();
  });

  it("S8_realistic_10_model_fixture", () => {
    // ParentBench overall scores for 10 hypothetical models, paired
    // with their capability z-scores. Hand-computed expected ρ.
    const pb = [92.4, 89, 86, 84, 80, 75, 70, 68, 60, 55];
    const cap = [1.8, 1.4, 1.0, 0.8, 0.4, -0.1, -0.5, -0.7, -1.2, -1.5];
    // Both arrays are monotonically decreasing → ρ ≈ 1
    expect(spearmanRank(pb, cap)).toBeCloseTo(1, 3);
  });

  it("should_return_zero_when_one_vector_is_constant", () => {
    // Constant vector has zero variance → correlation undefined; we
    // explicitly return 0 to avoid NaN propagation.
    expect(spearmanRank([1, 1, 1, 1], [1, 2, 3, 4])).toBe(0);
  });
});
