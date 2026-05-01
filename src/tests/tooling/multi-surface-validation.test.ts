/**
 * Multi-surface tooling tests for parentbench-6h3.
 *
 * Tests the pure validators and shapers that downstream tooling uses,
 * decoupled from filesystem IO so they can run under vitest with no
 * fixture cleanup needed.
 */

import { describe, it, expect } from "vitest";
import {
  assertOnePerModelSurface,
  type ScoreRowShape,
} from "@/lib/tooling/scores-validation";
import { groupScoresBySurface } from "@/lib/tooling/scores-export";
import type { EvaluationSurface } from "@/types/parentbench";

function makeScore(
  overrides: Partial<ScoreRowShape> = {}
): ScoreRowShape {
  return {
    modelSlug: "claude-opus-4-7",
    surface: "api-default" as EvaluationSurface,
    overallScore: 90,
    overallGrade: "A-",
    evaluatedDate: "2026-04-29",
    ...overrides,
  };
}

describe("assertOnePerModelSurface", () => {
  it("should_pass_when_each_model_surface_pair_appears_once", () => {
    // Arrange
    const rows = [
      makeScore({ modelSlug: "claude-opus-4-7", surface: "api-default" }),
      makeScore({ modelSlug: "claude-opus-4-7", surface: "web-product" }),
      makeScore({ modelSlug: "gpt-5", surface: "api-default" }),
    ];

    // Act
    const result = assertOnePerModelSurface(rows);

    // Assert
    expect(result.errors).toEqual([]);
  });

  it("should_flag_a_duplicate_pair", () => {
    // Arrange
    const rows = [
      makeScore({ modelSlug: "claude-opus-4-7", surface: "api-default" }),
      makeScore({ modelSlug: "claude-opus-4-7", surface: "api-default" }),
    ];

    // Act
    const result = assertOnePerModelSurface(rows);

    // Assert
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("claude-opus-4-7");
    expect(result.errors[0]).toContain("api-default");
  });

  it("should_treat_missing_surface_as_api_default_for_back_compat", () => {
    // Arrange — pre-migration rows without `surface` are implicitly api-default.
    const rows: ScoreRowShape[] = [
      makeScore({ modelSlug: "claude-opus-4-7", surface: "api-default" }),
      // @ts-expect-error — testing the back-compat fallback.
      { ...makeScore({ modelSlug: "claude-opus-4-7" }), surface: undefined },
    ];

    // Act
    const result = assertOnePerModelSurface(rows);

    // Assert — collision: both rows resolve to (claude-opus-4-7, api-default).
    expect(result.errors).toHaveLength(1);
  });
});

describe("groupScoresBySurface", () => {
  it("should_emit_one_entry_per_surface_in_predictable_order", () => {
    // Arrange
    const rows: ScoreRowShape[] = [
      makeScore({ modelSlug: "claude-opus-4-7", surface: "web-product" }),
      makeScore({ modelSlug: "claude-opus-4-7", surface: "api-default" }),
      makeScore({ modelSlug: "gpt-5", surface: "api-default" }),
    ];

    // Act
    const grouped = groupScoresBySurface(rows);

    // Assert
    expect(Object.keys(grouped).sort()).toEqual([
      "api-default",
      "web-product",
    ]);
    expect(grouped["api-default"]).toHaveLength(2);
    expect(grouped["web-product"]).toHaveLength(1);
  });

  it("should_assign_rows_with_missing_surface_to_api_default", () => {
    // Arrange
    const rows: ScoreRowShape[] = [
      // @ts-expect-error — back-compat test path.
      { ...makeScore(), surface: undefined },
    ];

    // Act
    const grouped = groupScoresBySurface(rows);

    // Assert
    expect(grouped["api-default"]).toHaveLength(1);
  });

  it("should_return_empty_object_for_empty_input", () => {
    expect(groupScoresBySurface([])).toEqual({});
  });
});
