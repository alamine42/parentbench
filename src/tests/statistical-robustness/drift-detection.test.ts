/**
 * Drift Detection Tests
 *
 * Tests for detecting and handling score drift including:
 * - Drift threshold detection
 * - Automatic rerun triggering
 * - Run cap enforcement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { _clearBatchScores, _registerBatchScores } from "@/lib/eval/drift-detection";

describe("Drift Detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _clearBatchScores();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _clearBatchScores();
  });

  describe("detectDrift", () => {
    it("should_return_true_when_score_differs_by_more_than_15_points", async () => {
      // Arrange
      const { detectDrift } = await import("@/lib/eval/drift-detection");
      const existingScores = [80, 82];
      const newScore = 60; // 20 points below median of 81

      // Act
      const hasDrift = detectDrift(existingScores, newScore);

      // Assert
      expect(hasDrift).toBe(true);
    });

    it("should_return_false_when_score_within_15_points_of_median", async () => {
      // Arrange
      const { detectDrift } = await import("@/lib/eval/drift-detection");
      const existingScores = [80, 82];
      const newScore = 75; // 6 points below median of 81

      // Act
      const hasDrift = detectDrift(existingScores, newScore);

      // Assert
      expect(hasDrift).toBe(false);
    });

    it("should_return_false_when_score_exactly_15_points_from_median", async () => {
      // Arrange
      const { detectDrift } = await import("@/lib/eval/drift-detection");
      const existingScores = [80, 80];
      const newScore = 65; // Exactly 15 points below median

      // Act
      const hasDrift = detectDrift(existingScores, newScore);

      // Assert
      expect(hasDrift).toBe(false); // <= 15 is acceptable
    });

    it("should_return_false_when_less_than_2_existing_scores", async () => {
      // Arrange
      const { detectDrift } = await import("@/lib/eval/drift-detection");
      const existingScores = [80];
      const newScore = 30; // Big difference but not enough data

      // Act
      const hasDrift = detectDrift(existingScores, newScore);

      // Assert
      expect(hasDrift).toBe(false);
    });

    it("should_handle_drift_above_median", async () => {
      // Arrange
      const { detectDrift } = await import("@/lib/eval/drift-detection");
      const existingScores = [60, 62];
      const newScore = 85; // 24 points above median of 61

      // Act
      const hasDrift = detectDrift(existingScores, newScore);

      // Assert
      expect(hasDrift).toBe(true);
    });
  });

  describe("canTriggerDriftRun", () => {
    it("should_return_true_when_under_max_runs", async () => {
      // Arrange
      const { canTriggerDriftRun } = await import("@/lib/eval/drift-detection");
      const batch = {
        completedRuns: 3,
        failedRuns: 0,
        maxRuns: 5,
      };

      // Act
      const canTrigger = canTriggerDriftRun(batch);

      // Assert
      expect(canTrigger).toBe(true);
    });

    it("should_return_false_when_at_max_runs", async () => {
      // Arrange
      const { canTriggerDriftRun } = await import("@/lib/eval/drift-detection");
      const batch = {
        completedRuns: 4,
        failedRuns: 1, // 4 + 1 = 5 = maxRuns
        maxRuns: 5,
      };

      // Act
      const canTrigger = canTriggerDriftRun(batch);

      // Assert
      expect(canTrigger).toBe(false);
    });

    it("should_return_false_when_over_max_runs", async () => {
      // Arrange
      const { canTriggerDriftRun } = await import("@/lib/eval/drift-detection");
      const batch = {
        completedRuns: 5,
        failedRuns: 1,
        maxRuns: 5,
      };

      // Act
      const canTrigger = canTriggerDriftRun(batch);

      // Assert
      expect(canTrigger).toBe(false);
    });
  });

  describe("handleDrift", () => {
    it("should_increment_target_runs_when_drift_detected", async () => {
      // Arrange
      const { handleDrift, _registerBatchScores } = await import("@/lib/eval/drift-detection");
      const mockBatch = {
        id: "batch-123",
        modelId: "model-456",
        targetRuns: 3,
        completedRuns: 2,
        failedRuns: 0,
        maxRuns: 5,
      };
      // Register existing scores so drift can be detected
      _registerBatchScores("batch-123", [80, 82]);

      // Act
      const result = await handleDrift(mockBatch, 50); // Drift-inducing score (30 pts below median)

      // Assert
      expect(result.driftDetected).toBe(true);
      expect(result.additionalRunQueued).toBe(true);
      expect(result.newTargetRuns).toBe(4);
    });

    it("should_not_queue_additional_run_when_at_max", async () => {
      // Arrange
      const { handleDrift, _registerBatchScores } = await import("@/lib/eval/drift-detection");
      const mockBatch = {
        id: "batch-123",
        modelId: "model-456",
        targetRuns: 5,
        completedRuns: 4,
        failedRuns: 1, // 4 + 1 = 5 = maxRuns
        maxRuns: 5,
      };
      _registerBatchScores("batch-123", [80, 82, 78, 81]);

      // Act
      const result = await handleDrift(mockBatch, 50);

      // Assert
      expect(result.driftDetected).toBe(true);
      expect(result.additionalRunQueued).toBe(false);
      expect(result.maxRunsReached).toBe(true);
    });

    it("should_trigger_admin_alert_when_max_runs_reached", async () => {
      // Arrange
      const { handleDrift, _registerBatchScores } = await import("@/lib/eval/drift-detection");
      const alertSpy = vi.fn();
      const mockBatch = {
        id: "batch-123",
        modelId: "model-456",
        targetRuns: 5,
        completedRuns: 5,
        failedRuns: 0,
        maxRuns: 5,
      };
      _registerBatchScores("batch-123", [80, 82, 78, 81, 79]);

      // Act
      const result = await handleDrift(mockBatch, 50, { onMaxRunsReached: alertSpy });

      // Assert
      expect(alertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          batchId: "batch-123",
          modelId: "model-456",
        })
      );
    });
  });

  describe("getDriftAmount", () => {
    it("should_return_absolute_difference_from_median", async () => {
      // Arrange
      const { getDriftAmount } = await import("@/lib/eval/drift-detection");
      const existingScores = [80, 82];
      const newScore = 60;

      // Act
      const amount = getDriftAmount(existingScores, newScore);

      // Assert
      expect(amount).toBe(21); // |60 - 81| = 21
    });

    it("should_return_0_when_no_existing_scores", async () => {
      // Arrange
      const { getDriftAmount } = await import("@/lib/eval/drift-detection");

      // Act
      const amount = getDriftAmount([], 80);

      // Assert
      expect(amount).toBe(0);
    });
  });
});
