/**
 * Numeric guard tests (parentbench-ov1.3).
 *
 * The guard rejects narratives that contain numbers absent from the
 * aggregate. It accepts:
 *   1. exact match against displayValues
 *   2. ±0.5 of any raw aggregate number
 *   3. small whitelist (years 2024-2030, ordinals, 100%, category count)
 */

import { describe, it, expect } from "vitest";
import { validateNarrativeAgainstAggregate } from "@/lib/insights/numeric-guard";
import type { InsightsAggregate } from "@/lib/insights/build-aggregate";

function makeAggregate(): InsightsAggregate {
  return {
    generatedAt: "2026-04-25T00:00:00Z",
    dataThrough: "2026-04-25T00:00:00Z",
    windowDays: 30,
    totals: { activeModels: 12, providers: 3, evalsLast30d: 7 },
    spread: { topScore: 92.4, topModelSlug: "x", bottomScore: 60, bottomModelSlug: "y", gap: 32.4, stdDev: 11 },
    providers: [
      {
        name: "Acme",
        avgOverall: 87,
        perCategory: {
          age_inappropriate_content: 90,
          manipulation_resistance: 85,
          data_privacy_minors: 88,
          parental_controls_respect: 85,
        },
        activeModelCount: 4,
      },
    ],
    categoryLeaders: {
      age_inappropriate_content: { modelSlug: "x", modelName: "X", provider: "Acme", score: 92.4 },
      manipulation_resistance: { modelSlug: "x", modelName: "X", provider: "Acme", score: 90 },
      data_privacy_minors: { modelSlug: "x", modelName: "X", provider: "Acme", score: 91 },
      parental_controls_respect: { modelSlug: "x", modelName: "X", provider: "Acme", score: 89 },
    },
    biggestMovers: [],
    newcomers: [],
    regressionWatch: [],
    displayValues: ["12", "92", "92.4", "60", "32", "32.4", "Acme", "87", "11"],
  };
}

const minimalNarrative = (text: string) => ({
  tldr: text,
  headlineMetric: { value: "92", caption: "Top score" },
  callouts: [],
  sections: [{ heading: "X", body: "" }],
  methodologyNote: "Methodology footer",
});

describe("validateNarrativeAgainstAggregate", () => {
  describe("numeric tokens (G1–G12 from design §5.2)", () => {
    it("G1_should_accept_exact_decimal_match", () => {
      const result = validateNarrativeAgainstAggregate(minimalNarrative("Top score is 92.4"), makeAggregate());
      expect(result.valid).toBe(true);
    });

    it("G2_should_accept_92_when_top_is_92_4_via_rounding_tolerance", () => {
      const result = validateNarrativeAgainstAggregate(minimalNarrative("Top score is 92"), makeAggregate());
      expect(result.valid).toBe(true);
    });

    it("G3_should_accept_provider_avg_87", () => {
      const result = validateNarrativeAgainstAggregate(minimalNarrative("Provider X leads with 87"), makeAggregate());
      expect(result.valid).toBe(true);
    });

    it("G4_should_reject_a_fabricated_number", () => {
      // 67 is not in any aggregate field nor within ±0.5 of any raw value
      const result = validateNarrativeAgainstAggregate(minimalNarrative("67% of models pass"), makeAggregate());
      expect(result.valid).toBe(false);
    });

    it("G5_should_accept_year_in_whitelist", () => {
      const result = validateNarrativeAgainstAggregate(minimalNarrative("Founded in 2026"), makeAggregate());
      expect(result.valid).toBe(true);
    });

    it("G6_should_accept_ordinal_1st", () => {
      const result = validateNarrativeAgainstAggregate(minimalNarrative("Ranked 1st overall"), makeAggregate());
      expect(result.valid).toBe(true);
    });

    it("G7_should_accept_active_model_count", () => {
      const result = validateNarrativeAgainstAggregate(minimalNarrative("All 12 models pass the bar"), makeAggregate());
      expect(result.valid).toBe(true);
    });

    it("G8_should_reject_empty_narrative", () => {
      const result = validateNarrativeAgainstAggregate({
        tldr: "",
        headlineMetric: { value: "", caption: "" },
        callouts: [],
        sections: [],
        methodologyNote: "",
      }, makeAggregate());
      expect(result.valid).toBe(false);
    });

    it("G9_should_accept_value_present_in_displayValues_exactly", () => {
      const result = validateNarrativeAgainstAggregate(minimalNarrative("The standard deviation is 11"), makeAggregate());
      expect(result.valid).toBe(true);
    });

    it("G11_should_accept_100_percent_in_whitelist", () => {
      const result = validateNarrativeAgainstAggregate(minimalNarrative("Almost 100% of models refused"), makeAggregate());
      expect(result.valid).toBe(true);
    });

    it("G12_should_reject_94_when_top_is_92_4_outside_tolerance", () => {
      const result = validateNarrativeAgainstAggregate(minimalNarrative("Score of 94"), makeAggregate());
      expect(result.valid).toBe(false);
    });

    it("G13_should_accept_window_days_reference_like_30_days", () => {
      // Regression: prod failure 2026-04-25 — "tested over 30 days" was rejected
      // because windowDays=30 wasn't surfaced to the guard.
      const result = validateNarrativeAgainstAggregate(
        minimalNarrative("Tested over 30 days for child safety"),
        makeAggregate()
      );
      expect(result.valid).toBe(true);
    });

    it("G14_should_accept_digits_inside_grounded_model_names", () => {
      // Regression: prod failure 2026-04-25 — narrative wrote "GPT-5.4 mini
      // Dropped Sharp..." and the validator pulled "5.4" out of the model name
      // and flagged it as a fabricated stat. Fix: strip displayValues from the
      // text before scanning so digits inside grounded identifiers are ignored.
      const agg = makeAggregate();
      agg.displayValues.push("GPT-5.4 mini");
      const result = validateNarrativeAgainstAggregate(
        minimalNarrative("GPT-5.4 mini Dropped Sharply this month"),
        agg
      );
      expect(result.valid).toBe(true);
    });

    it("G15_should_match_grounded_identifier_case_insensitively", () => {
      const agg = makeAggregate();
      agg.displayValues.push("Gemini 2.5 Pro");
      const result = validateNarrativeAgainstAggregate(
        // Writer used a different capitalization
        minimalNarrative("gemini 2.5 PRO held the line at the top"),
        agg
      );
      expect(result.valid).toBe(true);
    });
  });

  describe("multi-field validation", () => {
    it("should_check_callout_bodies_too", () => {
      const narrative = {
        ...minimalNarrative("Top score is 92"),
        callouts: [
          { kind: "category_leader" as const, title: "Best", body: "Hits 99 every time", subjectSlug: "x" },
        ],
      };
      const result = validateNarrativeAgainstAggregate(narrative, makeAggregate());
      expect(result.valid).toBe(false);
    });

    it("should_check_section_bodies_too", () => {
      const narrative = {
        ...minimalNarrative("Top score is 92"),
        sections: [{ heading: "Story", body: "We saw a fake 67 number drift in." }],
      };
      const result = validateNarrativeAgainstAggregate(narrative, makeAggregate());
      expect(result.valid).toBe(false);
    });

    it("should_return_failure_reason_on_rejection", () => {
      const result = validateNarrativeAgainstAggregate(minimalNarrative("67% of models pass"), makeAggregate());
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(result.failureReason).toContain("67");
      }
    });
  });

  describe("length floor", () => {
    it("should_reject_narrative_below_min_total_length", () => {
      const result = validateNarrativeAgainstAggregate({
        tldr: "Hi",
        headlineMetric: { value: "92", caption: "" },
        callouts: [],
        sections: [],
        methodologyNote: "",
      }, makeAggregate());
      expect(result.valid).toBe(false);
    });
  });
});
