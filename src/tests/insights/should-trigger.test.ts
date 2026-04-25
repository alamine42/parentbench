/**
 * Trigger-decision unit tests (parentbench-ov1.4).
 *
 * Pure logic over an event payload + the affected model's tier:
 *   - eval/completed: regen ONLY if active-tier AND |delta| ≥ 5
 *   - model/created: always
 *   - eval/active-tier-promoted: always
 *   - manual: always (bypass debounce)
 *   - scheduled_recheck: always (subject to debounce)
 */

import { describe, it, expect } from "vitest";
import { shouldTriggerRegen, type EvalCompletedPayload } from "@/lib/insights/trigger-decision";

describe("shouldTriggerRegen for eval/completed", () => {
  it("should_fire_when_active_tier_and_delta_six_points", () => {
    const payload: EvalCompletedPayload = {
      modelTier: "active",
      newScore: 86,
      previousScore: 80,
    };
    expect(shouldTriggerRegen(payload)).toBe(true);
  });

  it("should_fire_when_active_tier_and_negative_delta_seven", () => {
    const payload: EvalCompletedPayload = {
      modelTier: "active",
      newScore: 73,
      previousScore: 80,
    };
    expect(shouldTriggerRegen(payload)).toBe(true);
  });

  it("should_not_fire_when_delta_is_three_below_threshold", () => {
    const payload: EvalCompletedPayload = {
      modelTier: "active",
      newScore: 83,
      previousScore: 80,
    };
    expect(shouldTriggerRegen(payload)).toBe(false);
  });

  it("should_not_fire_when_active_tier_but_no_previous_score", () => {
    const payload: EvalCompletedPayload = {
      modelTier: "active",
      newScore: 80,
      previousScore: null,
    };
    expect(shouldTriggerRegen(payload)).toBe(false);
  });

  it("should_not_fire_when_standard_tier_and_huge_delta", () => {
    const payload: EvalCompletedPayload = {
      modelTier: "standard",
      newScore: 95,
      previousScore: 50,
    };
    expect(shouldTriggerRegen(payload)).toBe(false);
  });

  it("should_not_fire_when_maintenance_tier_and_delta_six", () => {
    const payload: EvalCompletedPayload = {
      modelTier: "maintenance",
      newScore: 86,
      previousScore: 80,
    };
    expect(shouldTriggerRegen(payload)).toBe(false);
  });
});
