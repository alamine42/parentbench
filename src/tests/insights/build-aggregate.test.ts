/**
 * Aggregator unit tests (parentbench-ov1.1).
 *
 * The aggregator is a PURE function over already-fetched DB rows. Tests
 * use synthetic fixtures — no real DB, no cleanup required.
 */

import { describe, it, expect } from "vitest";
import { buildAggregate, type AggregatorInput } from "@/lib/insights/build-aggregate";
import type { ParentBenchCategory } from "@/types/parentbench";

const CATEGORIES: ParentBenchCategory[] = [
  "age_inappropriate_content",
  "manipulation_resistance",
  "data_privacy_minors",
  "parental_controls_respect",
];

function makeCategoryScores(overall: number) {
  return CATEGORIES.map((category) => ({
    category,
    score: overall,
    grade: "B",
    passRate: overall,
    testCount: 12,
  }));
}

function makeInput(overrides?: Partial<AggregatorInput>): AggregatorInput {
  const now = new Date("2026-04-25T00:00:00Z");
  return {
    asOf: now,
    windowDays: 30,
    activeModels: [
      { modelId: "m1", slug: "model-a", name: "Model A", provider: "Acme", evalTier: "active", isActive: true, createdAt: new Date("2026-01-01") },
      { modelId: "m2", slug: "model-b", name: "Model B", provider: "Acme", evalTier: "active", isActive: true, createdAt: new Date("2026-01-01") },
      { modelId: "m3", slug: "model-c", name: "Model C", provider: "Beta", evalTier: "active", isActive: true, createdAt: new Date("2026-01-01") },
      { modelId: "m4", slug: "model-d", name: "Model D", provider: "Beta", evalTier: "active", isActive: true, createdAt: new Date("2026-01-01") },
      { modelId: "m5", slug: "model-e", name: "Model E", provider: "Gamma", evalTier: "active", isActive: true, createdAt: new Date("2026-01-01") },
    ],
    latestScores: [
      { modelId: "m1", overallScore: 92.4, computedAt: new Date("2026-04-20"), categoryScores: makeCategoryScores(92.4) },
      { modelId: "m2", overallScore: 80, computedAt: new Date("2026-04-20"), categoryScores: makeCategoryScores(80) },
      { modelId: "m3", overallScore: 75, computedAt: new Date("2026-04-20"), categoryScores: makeCategoryScores(75) },
      { modelId: "m4", overallScore: 70, computedAt: new Date("2026-04-20"), categoryScores: makeCategoryScores(70) },
      { modelId: "m5", overallScore: 60, computedAt: new Date("2026-04-20"), categoryScores: makeCategoryScores(60) },
    ],
    previousScores: [
      // none of the models have a prior score by default
    ],
    evalsLast30d: 12,
    ...overrides,
  };
}

describe("buildAggregate", () => {
  describe("totals", () => {
    it("should_count_active_models_and_distinct_providers", () => {
      const result = buildAggregate(makeInput());
      expect(result.totals.activeModels).toBe(5);
      expect(result.totals.providers).toBe(3);
    });

    it("should_carry_evals_last_30d_through_unchanged", () => {
      const result = buildAggregate(makeInput({ evalsLast30d: 7 }));
      expect(result.totals.evalsLast30d).toBe(7);
    });
  });

  describe("biggestMovers (≥5pt threshold)", () => {
    it("should_include_a_model_with_plus_6_delta", () => {
      const input = makeInput({
        previousScores: [{ modelId: "m1", overallScore: 86.4 }],
      });
      const result = buildAggregate(input);
      expect(result.biggestMovers).toHaveLength(1);
      expect(result.biggestMovers[0].modelSlug).toBe("model-a");
      expect(result.biggestMovers[0].direction).toBe("up");
      expect(result.biggestMovers[0].deltaPoints).toBeCloseTo(6, 1);
    });

    it("should_exclude_a_model_with_plus_3_delta_below_threshold", () => {
      const input = makeInput({
        previousScores: [{ modelId: "m1", overallScore: 89.4 }],
      });
      const result = buildAggregate(input);
      expect(result.biggestMovers).toHaveLength(0);
    });

    it("should_include_a_model_with_minus_7_delta_in_movers_and_regressions", () => {
      const input = makeInput({
        previousScores: [{ modelId: "m2", overallScore: 87 }],
      });
      const result = buildAggregate(input);
      expect(result.biggestMovers.find((m) => m.modelSlug === "model-b")?.direction).toBe("down");
      expect(result.regressionWatch.find((r) => r.modelSlug === "model-b")).toBeDefined();
    });
  });

  describe("newcomers", () => {
    it("should_include_a_model_added_in_window", () => {
      const result = buildAggregate(makeInput({
        activeModels: [
          ...makeInput().activeModels.slice(0, 4),
          { modelId: "m5", slug: "model-e", name: "Model E", provider: "Gamma", evalTier: "active", isActive: true, createdAt: new Date("2026-04-20") },
        ],
      }));
      expect(result.newcomers).toHaveLength(1);
      expect(result.newcomers[0].modelSlug).toBe("model-e");
    });

    it("should_compute_percentile_for_newcomer", () => {
      // m5 has score 60; with [60, 70, 75, 80, 92.4], it's the lowest → percentile 0
      const result = buildAggregate(makeInput({
        activeModels: [
          ...makeInput().activeModels.slice(0, 4),
          { modelId: "m5", slug: "model-e", name: "Model E", provider: "Gamma", evalTier: "active", isActive: true, createdAt: new Date("2026-04-20") },
        ],
      }));
      expect(result.newcomers[0].percentile).toBeCloseTo(0, 1);
    });
  });

  describe("spread", () => {
    it("should_compute_zero_spread_when_all_scores_equal", () => {
      const flatScores = [85, 85, 85, 85, 85];
      const input = makeInput({
        latestScores: makeInput().latestScores.map((s, i) => ({
          ...s,
          overallScore: flatScores[i],
          categoryScores: makeCategoryScores(flatScores[i]),
        })),
      });
      const result = buildAggregate(input);
      expect(result.spread.gap).toBe(0);
      expect(result.spread.stdDev).toBe(0);
    });

    it("should_identify_top_and_bottom_models", () => {
      const result = buildAggregate(makeInput());
      expect(result.spread.topScore).toBe(92.4);
      expect(result.spread.topModelSlug).toBe("model-a");
      expect(result.spread.bottomScore).toBe(60);
      expect(result.spread.bottomModelSlug).toBe("model-e");
    });
  });

  describe("calm window (Codex CRITICAL #3 — empty buckets are valid)", () => {
    it("should_produce_valid_aggregate_when_no_movers_no_newcomers_no_regressions", () => {
      // No previous scores, all models added long ago → all buckets empty
      const result = buildAggregate(makeInput());
      expect(result.biggestMovers).toEqual([]);
      expect(result.newcomers).toEqual([]);
      expect(result.regressionWatch).toEqual([]);
      // Category leaders still populated though
      expect(Object.keys(result.categoryLeaders)).toHaveLength(4);
    });
  });

  describe("inactive models", () => {
    it("should_exclude_inactive_models_from_every_section", () => {
      const input = makeInput();
      // Mark m1 (the top scorer) inactive
      input.activeModels = input.activeModels.filter((m) => m.modelId !== "m1");
      const result = buildAggregate(input);
      expect(result.spread.topModelSlug).not.toBe("model-a");
      expect(Object.values(result.categoryLeaders).every((l) => l.modelSlug !== "model-a")).toBe(true);
    });
  });

  describe("displayValues (Codex WARNING #2 — readable rounding)", () => {
    it("should_include_top_score_both_raw_and_rounded", () => {
      const result = buildAggregate(makeInput());
      expect(result.displayValues).toContain("92.4");
      expect(result.displayValues).toContain("92");
    });

    it("should_include_provider_names_verbatim", () => {
      const result = buildAggregate(makeInput());
      expect(result.displayValues).toContain("Acme");
      expect(result.displayValues).toContain("Beta");
      expect(result.displayValues).toContain("Gamma");
    });

    it("should_include_active_model_count", () => {
      const result = buildAggregate(makeInput());
      expect(result.displayValues).toContain("5");
    });

    it("should_include_gap_phrasing", () => {
      const result = buildAggregate(makeInput());
      // gap = 92.4 - 60 = 32.4
      expect(result.displayValues).toContain("32.4");
    });
  });

  describe("categoryLeaders", () => {
    it("should_pick_top_scorer_per_category", () => {
      const result = buildAggregate(makeInput());
      for (const cat of CATEGORIES) {
        expect(result.categoryLeaders[cat].modelSlug).toBe("model-a");
      }
    });
  });

  describe("providers rollup", () => {
    it("should_compute_avg_per_provider", () => {
      const result = buildAggregate(makeInput());
      const acme = result.providers.find((p) => p.name === "Acme")!;
      // Acme has m1=92.4 and m2=80 → avg = 86.2
      expect(acme.avgOverall).toBeCloseTo(86.2, 1);
      expect(acme.activeModelCount).toBe(2);
    });
  });
});
