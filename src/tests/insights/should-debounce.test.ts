/**
 * Debounce decision tests (parentbench-ov1.4).
 *
 * Pure decision function — given the time of the last published report
 * and the current time, returns whether a regen should fire or be
 * suppressed. Triggered events are NOT carried forward (Codex WARNING #1
 * fix); Inngest's own event log is the audit trail.
 */

import { describe, it, expect } from "vitest";
import { shouldDebounce, DEBOUNCE_WINDOW_HOURS } from "@/lib/insights/debounce";

const HOUR = 60 * 60 * 1000;

describe("shouldDebounce", () => {
  describe("no prior published report", () => {
    it("should_not_debounce_when_no_published_report_exists", () => {
      const result = shouldDebounce({
        lastPublishedAt: null,
        now: new Date("2026-04-25T12:00:00Z"),
      });
      expect(result).toBe(false);
    });
  });

  describe("recent published report (inside window)", () => {
    it("should_debounce_when_last_publish_was_six_hours_ago", () => {
      const now = new Date("2026-04-25T12:00:00Z");
      const sixHoursAgo = new Date(now.getTime() - 6 * HOUR);
      const result = shouldDebounce({ lastPublishedAt: sixHoursAgo, now });
      expect(result).toBe(true);
    });

    it("should_debounce_when_last_publish_was_just_under_window", () => {
      const now = new Date("2026-04-25T12:00:00Z");
      const justUnder = new Date(now.getTime() - (DEBOUNCE_WINDOW_HOURS - 0.5) * HOUR);
      const result = shouldDebounce({ lastPublishedAt: justUnder, now });
      expect(result).toBe(true);
    });
  });

  describe("old published report (outside window)", () => {
    it("should_not_debounce_when_last_publish_was_thirty_hours_ago", () => {
      const now = new Date("2026-04-25T12:00:00Z");
      const thirtyHoursAgo = new Date(now.getTime() - 30 * HOUR);
      const result = shouldDebounce({ lastPublishedAt: thirtyHoursAgo, now });
      expect(result).toBe(false);
    });

    it("should_not_debounce_when_last_publish_was_exactly_window", () => {
      const now = new Date("2026-04-25T12:00:00Z");
      const exactWindow = new Date(now.getTime() - DEBOUNCE_WINDOW_HOURS * HOUR);
      const result = shouldDebounce({ lastPublishedAt: exactWindow, now });
      // Exact boundary: NOT debounced (allow retry)
      expect(result).toBe(false);
    });
  });

  describe("only failed/retracted reports exist (Codex WARNING #4 corollary)", () => {
    it("should_not_debounce_when_no_published_report_only_failed", () => {
      const result = shouldDebounce({
        lastPublishedAt: null, // caller filters status='published' before passing
        now: new Date("2026-04-25T12:00:00Z"),
      });
      expect(result).toBe(false);
    });
  });
});
