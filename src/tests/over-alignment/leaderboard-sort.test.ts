import { describe, it, expect } from "vitest";
import { sortByNetHelpfulness } from "@/lib/leaderboard/sort";

type Row = { modelSlug: string; overallScore: number; netHelpfulness: number | null | undefined };

describe("sortByNetHelpfulness", () => {
  it("should_sort_descending_by_net_helpfulness_when_all_present", () => {
    const rows: Row[] = [
      { modelSlug: "a", overallScore: 80, netHelpfulness: 60 },
      { modelSlug: "b", overallScore: 80, netHelpfulness: 90 },
      { modelSlug: "c", overallScore: 80, netHelpfulness: 75 },
    ];
    const sorted = sortByNetHelpfulness(rows);
    expect(sorted.map((r) => r.modelSlug)).toEqual(["b", "c", "a"]);
  });

  it("should_sink_null_net_helpfulness_to_the_bottom", () => {
    const rows: Row[] = [
      { modelSlug: "a", overallScore: 80, netHelpfulness: null },
      { modelSlug: "b", overallScore: 80, netHelpfulness: 90 },
      { modelSlug: "c", overallScore: 80, netHelpfulness: 75 },
    ];
    const sorted = sortByNetHelpfulness(rows);
    expect(sorted[sorted.length - 1].modelSlug).toBe("a");
  });

  it("should_sink_undefined_net_helpfulness_to_the_bottom", () => {
    const rows: Row[] = [
      { modelSlug: "a", overallScore: 80, netHelpfulness: undefined },
      { modelSlug: "b", overallScore: 80, netHelpfulness: 90 },
    ];
    const sorted = sortByNetHelpfulness(rows);
    expect(sorted[sorted.length - 1].modelSlug).toBe("a");
  });

  it("should_tiebreak_by_overall_safety_score_when_NH_equal", () => {
    const rows: Row[] = [
      { modelSlug: "a", overallScore: 70, netHelpfulness: 80 },
      { modelSlug: "b", overallScore: 90, netHelpfulness: 80 },
    ];
    const sorted = sortByNetHelpfulness(rows);
    expect(sorted[0].modelSlug).toBe("b");
  });

  it("should_tiebreak_by_overall_safety_among_null_NH_rows", () => {
    const rows: Row[] = [
      { modelSlug: "a", overallScore: 60, netHelpfulness: null },
      { modelSlug: "b", overallScore: 80, netHelpfulness: null },
    ];
    const sorted = sortByNetHelpfulness(rows);
    expect(sorted[0].modelSlug).toBe("b");
  });

  it("should_not_mutate_input_array", () => {
    const rows: Row[] = [
      { modelSlug: "a", overallScore: 80, netHelpfulness: 60 },
      { modelSlug: "b", overallScore: 80, netHelpfulness: 90 },
    ];
    sortByNetHelpfulness(rows);
    expect(rows[0].modelSlug).toBe("a");
  });

  it("should_handle_empty_array", () => {
    expect(sortByNetHelpfulness([])).toEqual([]);
  });
});
