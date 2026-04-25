/**
 * Report-selection unit tests (parentbench-ov1.5).
 *
 * `/insights` shows the latest published report. If the latest is
 * generation_failed or retracted, fall back to the prior published one
 * (Codex CRITICAL #1 corollary — failure paths must not become public).
 */

import { describe, it, expect } from "vitest";
import { pickPublishedForInsightsRoute } from "@/lib/insights/pick-report";

type Row = {
  id: string;
  status: "draft" | "generation_failed" | "published" | "retracted";
  generatedAt: Date;
};

const r = (id: string, status: Row["status"], offsetHours: number): Row => ({
  id,
  status,
  generatedAt: new Date(Date.UTC(2026, 3, 25, 12 - offsetHours)),
});

describe("pickPublishedForInsightsRoute", () => {
  it("should_return_null_when_no_reports_exist", () => {
    expect(pickPublishedForInsightsRoute([])).toBeNull();
  });

  it("should_return_null_when_only_drafts_exist", () => {
    const rows = [r("a", "draft", 0)];
    expect(pickPublishedForInsightsRoute(rows)).toBeNull();
  });

  it("should_return_the_latest_published_report", () => {
    const rows = [
      r("old", "published", 48),
      r("latest", "published", 1),
      r("draft", "draft", 0),
    ];
    const picked = pickPublishedForInsightsRoute(rows);
    expect(picked?.id).toBe("latest");
  });

  it("should_skip_generation_failed_and_pick_prior_published", () => {
    const rows = [
      r("old-pub", "published", 48),
      r("failed", "generation_failed", 1),
    ];
    const picked = pickPublishedForInsightsRoute(rows);
    expect(picked?.id).toBe("old-pub");
  });

  it("should_skip_retracted_and_pick_prior_published", () => {
    const rows = [
      r("old-pub", "published", 48),
      r("retracted", "retracted", 1),
    ];
    const picked = pickPublishedForInsightsRoute(rows);
    expect(picked?.id).toBe("old-pub");
  });

  it("should_return_null_when_only_failed_or_retracted_reports_exist", () => {
    const rows = [
      r("failed", "generation_failed", 24),
      r("retracted", "retracted", 1),
    ];
    expect(pickPublishedForInsightsRoute(rows)).toBeNull();
  });
});
