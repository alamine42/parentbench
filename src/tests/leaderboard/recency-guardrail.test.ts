/**
 * Recency-guardrail tests for the per-model surface comparison panel.
 *
 * Bands (defined in src/lib/leaderboard/recency.ts):
 *   <= 14d   → "ok"        render normally
 *   14–30d   → "caveat"    render with drift-warning notice
 *   > 30d    → "stale"     hide deltas; show side-by-side only
 */

import { describe, it, expect } from "vitest";
import { compareRecency } from "@/lib/leaderboard/recency";

const FIXED_NOW = new Date("2026-05-01T00:00:00Z");

function daysAgo(d: number): string {
  const t = new Date(FIXED_NOW.getTime() - d * 86400_000);
  return t.toISOString().split("T")[0];
}

describe("compareRecency", () => {
  it("should_return_ok_when_runs_are_within_14_days_of_each_other", () => {
    const result = compareRecency(daysAgo(0), daysAgo(10));
    expect(result.band).toBe("ok");
    expect(result.deltaDays).toBe(10);
  });

  it("should_return_ok_at_exactly_14_days", () => {
    expect(compareRecency(daysAgo(0), daysAgo(14)).band).toBe("ok");
  });

  it("should_return_caveat_between_14_and_30_days", () => {
    const result = compareRecency(daysAgo(0), daysAgo(20));
    expect(result.band).toBe("caveat");
    expect(result.deltaDays).toBe(20);
  });

  it("should_return_caveat_at_exactly_30_days", () => {
    expect(compareRecency(daysAgo(0), daysAgo(30)).band).toBe("caveat");
  });

  it("should_return_stale_when_runs_are_more_than_30_days_apart", () => {
    expect(compareRecency(daysAgo(0), daysAgo(45)).band).toBe("stale");
  });

  it("should_be_symmetric_regardless_of_argument_order", () => {
    expect(compareRecency(daysAgo(40), daysAgo(0)).band).toBe("stale");
    expect(compareRecency(daysAgo(0), daysAgo(40)).band).toBe("stale");
  });

  it("should_treat_missing_dates_as_stale_for_safety", () => {
    expect(compareRecency(undefined, daysAgo(0)).band).toBe("stale");
    expect(compareRecency(daysAgo(0), null).band).toBe("stale");
  });
});
