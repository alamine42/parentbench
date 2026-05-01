/**
 * Component tests for the per-model surface comparison panel
 * (parentbench-bb7).
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SurfaceComparison } from "@/components/parentbench/surface-comparison";
import type { ParentBenchResult } from "@/types/parentbench";

function makeResult(
  overrides: Partial<ParentBenchResult> = {}
): ParentBenchResult {
  return {
    modelSlug: "claude-opus-4-7",
    overallScore: 90,
    overallGrade: "A-",
    trend: "stable",
    categoryScores: [],
    evaluatedDate: "2026-04-29",
    dataQuality: "verified",
    methodologyVersion: "1.0.0",
    surface: "api-default",
    falseRefusalRate: 0.04,
    netHelpfulness: 86,
    benignRefusalCount: 1,
    benignTotalCount: 25,
    refusedBenignCaseIds: [],
    confidence: "high",
    variance: 1.2,
    isPartial: false,
    ...overrides,
  };
}

describe("SurfaceComparison", () => {
  it("should_render_nothing_when_only_one_surface_is_present", () => {
    // Arrange
    const surfaces = [makeResult({ surface: "api-default" })];

    // Act
    const { container } = render(<SurfaceComparison surfaces={surfaces} />);

    // Assert
    expect(container.firstChild).toBeNull();
  });

  it("should_render_a_panel_with_per_surface_columns_when_two_surfaces_exist", () => {
    // Arrange
    const surfaces = [
      makeResult({ surface: "api-default", overallScore: 90 }),
      makeResult({ surface: "web-product", overallScore: 76 }),
    ];

    // Act
    render(<SurfaceComparison surfaces={surfaces} />);

    // Assert
    // Both labels appear at least once. Score values appear at least once;
    // the panel renders both desktop hero numbers and a mobile metrics
    // list, so duplicates are expected and are fine.
    expect(screen.getAllByText(/api default/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/web/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("90").length).toBeGreaterThan(0);
    expect(screen.getAllByText("76").length).toBeGreaterThan(0);
  });

  it("should_show_drift_caveat_when_surfaces_are_14_to_30_days_apart", () => {
    // Arrange — 20 days apart triggers caveat band.
    const surfaces = [
      makeResult({ surface: "api-default", evaluatedDate: "2026-04-29" }),
      makeResult({ surface: "web-product", evaluatedDate: "2026-04-09" }),
    ];

    // Act
    render(<SurfaceComparison surfaces={surfaces} />);

    // Assert
    expect(screen.getByText(/may include model drift/i)).toBeInTheDocument();
  });

  it("should_hide_deltas_when_surfaces_are_more_than_30_days_apart", () => {
    // Arrange — 60 days apart triggers stale band.
    const surfaces = [
      makeResult({ surface: "api-default", evaluatedDate: "2026-04-29" }),
      makeResult({ surface: "web-product", evaluatedDate: "2026-02-28" }),
    ];

    // Act
    render(<SurfaceComparison surfaces={surfaces} />);

    // Assert — the stale-state CTA appears, and no Δ column is rendered.
    expect(screen.getByText(/scores not paired/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Δ/)).toBeNull();
  });

  it("should_render_normally_when_surfaces_are_within_14_days", () => {
    // Arrange
    const surfaces = [
      makeResult({ surface: "api-default", evaluatedDate: "2026-04-29", overallScore: 90 }),
      makeResult({ surface: "web-product", evaluatedDate: "2026-04-25", overallScore: 76 }),
    ];

    // Act
    render(<SurfaceComparison surfaces={surfaces} />);

    // Assert — neither caveat nor stale message present.
    expect(screen.queryByText(/may include model drift/i)).toBeNull();
    expect(screen.queryByText(/scores not paired/i)).toBeNull();
  });
});
