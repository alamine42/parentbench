/**
 * Capability score validation tests (parentbench-rg1.1).
 *
 * Server-side guardrails for admin-curated capability benchmark scores.
 * Pure rule logic — no DB, no I/O.
 */

import { describe, it, expect } from "vitest";
import { validateCapabilityScoreInput } from "@/lib/capability/validation";

const baseInput = {
  modelId: "550e8400-e29b-41d4-a716-446655440000",
  benchmark: "mmlu" as const,
  score: 72.4,
  sourceUrl: "https://example.com/model-card",
  shotSetting: "5-shot",
  benchmarkVariant: null,
  sourceNote: null,
};

describe("validateCapabilityScoreInput", () => {
  describe("score range", () => {
    it("should_accept_score_at_zero", () => {
      const r = validateCapabilityScoreInput({ ...baseInput, score: 0 });
      expect(r.valid).toBe(true);
    });

    it("should_accept_score_at_one_hundred", () => {
      const r = validateCapabilityScoreInput({ ...baseInput, score: 100 });
      expect(r.valid).toBe(true);
    });

    it("should_reject_negative_score", () => {
      const r = validateCapabilityScoreInput({ ...baseInput, score: -1 });
      expect(r.valid).toBe(false);
    });

    it("should_reject_score_above_one_hundred", () => {
      const r = validateCapabilityScoreInput({ ...baseInput, score: 100.1 });
      expect(r.valid).toBe(false);
    });

    it("should_reject_NaN_score", () => {
      const r = validateCapabilityScoreInput({ ...baseInput, score: Number.NaN });
      expect(r.valid).toBe(false);
    });

    it("should_reject_non_numeric_score", () => {
      const r = validateCapabilityScoreInput({ ...baseInput, score: "high" as unknown as number });
      expect(r.valid).toBe(false);
    });
  });

  describe("source URL", () => {
    it("should_accept_https_url", () => {
      const r = validateCapabilityScoreInput({ ...baseInput, sourceUrl: "https://arxiv.org/abs/1234" });
      expect(r.valid).toBe(true);
    });

    it("should_accept_http_url", () => {
      const r = validateCapabilityScoreInput({ ...baseInput, sourceUrl: "http://example.com" });
      expect(r.valid).toBe(true);
    });

    it("should_reject_empty_url", () => {
      const r = validateCapabilityScoreInput({ ...baseInput, sourceUrl: "" });
      expect(r.valid).toBe(false);
    });

    it("should_reject_non_http_protocol", () => {
      const r = validateCapabilityScoreInput({ ...baseInput, sourceUrl: "javascript:alert(1)" });
      expect(r.valid).toBe(false);
    });

    it("should_reject_relative_url", () => {
      const r = validateCapabilityScoreInput({ ...baseInput, sourceUrl: "/some/path" });
      expect(r.valid).toBe(false);
    });
  });

  describe("benchmark enum", () => {
    it("should_accept_mmlu", () => {
      const r = validateCapabilityScoreInput({ ...baseInput, benchmark: "mmlu" });
      expect(r.valid).toBe(true);
    });

    it("should_accept_gsm8k", () => {
      const r = validateCapabilityScoreInput({ ...baseInput, benchmark: "gsm8k" });
      expect(r.valid).toBe(true);
    });

    it("should_accept_gpqa", () => {
      const r = validateCapabilityScoreInput({ ...baseInput, benchmark: "gpqa" });
      expect(r.valid).toBe(true);
    });

    it("should_reject_unknown_benchmark", () => {
      const r = validateCapabilityScoreInput({ ...baseInput, benchmark: "hellaswag" as unknown as "mmlu" });
      expect(r.valid).toBe(false);
    });
  });

  describe("modelId", () => {
    it("should_reject_empty_modelId", () => {
      const r = validateCapabilityScoreInput({ ...baseInput, modelId: "" });
      expect(r.valid).toBe(false);
    });

    it("should_reject_obviously_malformed_modelId", () => {
      const r = validateCapabilityScoreInput({ ...baseInput, modelId: "not-a-uuid" });
      expect(r.valid).toBe(false);
    });
  });

  describe("optional metadata", () => {
    it("should_accept_null_shotSetting", () => {
      const r = validateCapabilityScoreInput({ ...baseInput, shotSetting: null });
      expect(r.valid).toBe(true);
    });

    it("should_warn_when_shotSetting_is_missing", () => {
      const r = validateCapabilityScoreInput({ ...baseInput, shotSetting: null });
      expect(r.warnings).toContain("shotSetting_unspecified");
    });

    it("should_not_warn_when_shotSetting_is_provided", () => {
      const r = validateCapabilityScoreInput({ ...baseInput, shotSetting: "5-shot" });
      expect(r.warnings).not.toContain("shotSetting_unspecified");
    });
  });

  describe("failure reason", () => {
    it("should_return_a_specific_reason_for_score_out_of_range", () => {
      const r = validateCapabilityScoreInput({ ...baseInput, score: 150 });
      expect(r.valid).toBe(false);
      if (!r.valid) {
        expect(r.errors.some((e) => e.includes("score"))).toBe(true);
      }
    });
  });
});
