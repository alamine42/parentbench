/**
 * Score Batches Tests
 *
 * Tests for multi-run evaluation batches including:
 * - Batch creation with version pinning
 * - Run tracking within batches
 * - Batch completion detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { _clearBatches, _setTestSuiteHash } from "@/lib/eval/score-batches";

describe("Score Batches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _clearBatches();
    // Set a valid 64-character hex string (SHA256 format)
    _setTestSuiteHash("abc123def456789012345678901234567890123456789012345678901234abcd");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _clearBatches();
  });

  describe("createScoreBatch", () => {
    it("should_create_batch_with_default_target_runs_of_3", async () => {
      // Arrange
      const { createScoreBatch } = await import("@/lib/eval/score-batches");
      const modelId = "model-123";
      const triggeredBy = "scheduled";

      // Act
      const batch = await createScoreBatch(modelId, triggeredBy);

      // Assert
      expect(batch.targetRuns).toBe(3);
      expect(batch.completedRuns).toBe(0);
      expect(batch.failedRuns).toBe(0);
      expect(batch.status).toBe("pending");
    });

    it("should_pin_methodology_version_at_creation", async () => {
      // Arrange
      const { createScoreBatch } = await import("@/lib/eval/score-batches");
      const modelId = "model-123";

      // Act
      const batch = await createScoreBatch(modelId, "manual");

      // Assert
      expect(batch.methodologyVersion).toBeDefined();
      expect(typeof batch.methodologyVersion).toBe("string");
      expect(batch.methodologyVersion.length).toBeGreaterThan(0);
    });

    it("should_compute_test_suite_hash_from_active_test_cases", async () => {
      // Arrange
      const { createScoreBatch } = await import("@/lib/eval/score-batches");
      const modelId = "model-123";

      // Act
      const batch = await createScoreBatch(modelId, "manual");

      // Assert
      expect(batch.testSuiteHash).toBeDefined();
      expect(batch.testSuiteHash).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex
    });

    it("should_set_max_runs_to_5_by_default", async () => {
      // Arrange
      const { createScoreBatch } = await import("@/lib/eval/score-batches");

      // Act
      const batch = await createScoreBatch("model-123", "scheduled");

      // Assert
      expect(batch.maxRuns).toBe(5);
    });

    it("should_store_model_version_if_provided", async () => {
      // Arrange
      const { createScoreBatch } = await import("@/lib/eval/score-batches");
      const modelId = "model-123";
      const modelVersion = "2024-03-15";

      // Act
      const batch = await createScoreBatch(modelId, "manual", { modelVersion });

      // Assert
      expect(batch.modelVersion).toBe(modelVersion);
    });
  });

  describe("validateRunVersion", () => {
    it("should_pass_when_test_suite_hash_matches", async () => {
      // Arrange
      const { validateRunVersion, createScoreBatch } = await import("@/lib/eval/score-batches");
      const batch = await createScoreBatch("model-123", "manual");

      // Act & Assert - should not throw
      await expect(validateRunVersion(batch.id)).resolves.not.toThrow();
    });

    it("should_reject_when_test_suite_changed_since_batch_creation", async () => {
      // Arrange
      const { validateRunVersion, createScoreBatch, _setTestSuiteHash } = await import("@/lib/eval/score-batches");
      const batch = await createScoreBatch("model-123", "manual");

      // Change the test suite hash after batch creation
      _setTestSuiteHash("new-different-hash-value-here-that-is-64-characters-long-abcdef");

      // Act & Assert
      await expect(validateRunVersion(batch.id)).rejects.toThrow(
        "Test suite changed since batch created"
      );
    });
  });

  describe("updateBatchProgress", () => {
    it("should_increment_completed_runs_on_success", async () => {
      // Arrange
      const { updateBatchProgress, createScoreBatch } = await import("@/lib/eval/score-batches");
      const batch = await createScoreBatch("model-123", "manual");

      // Act
      const updated = await updateBatchProgress(batch.id, { success: true, score: 85 });

      // Assert
      expect(updated.completedRuns).toBe(1);
      expect(updated.failedRuns).toBe(0);
    });

    it("should_increment_failed_runs_on_failure", async () => {
      // Arrange
      const { updateBatchProgress, createScoreBatch } = await import("@/lib/eval/score-batches");
      const batch = await createScoreBatch("model-123", "manual");

      // Act
      const updated = await updateBatchProgress(batch.id, {
        success: false,
        error: "API timeout"
      });

      // Assert
      expect(updated.completedRuns).toBe(0);
      expect(updated.failedRuns).toBe(1);
      expect(updated.lastError).toBe("API timeout");
    });

    it("should_transition_to_in_progress_on_first_run", async () => {
      // Arrange
      const { updateBatchProgress, createScoreBatch } = await import("@/lib/eval/score-batches");
      const batch = await createScoreBatch("model-123", "manual");
      expect(batch.status).toBe("pending");

      // Act
      const updated = await updateBatchProgress(batch.id, { success: true, score: 80 });

      // Assert
      expect(updated.status).toBe("in_progress");
    });
  });

  describe("isBatchComplete", () => {
    it("should_return_true_when_completed_runs_equals_target_runs", async () => {
      // Arrange
      const { isBatchComplete } = await import("@/lib/eval/score-batches");
      const batch = {
        targetRuns: 3,
        completedRuns: 3,
        failedRuns: 0,
        maxRuns: 5,
      };

      // Act
      const result = isBatchComplete(batch);

      // Assert
      expect(result).toBe(true);
    });

    it("should_return_false_when_runs_still_pending", async () => {
      // Arrange
      const { isBatchComplete } = await import("@/lib/eval/score-batches");
      const batch = {
        targetRuns: 3,
        completedRuns: 2,
        failedRuns: 0,
        maxRuns: 5,
      };

      // Act
      const result = isBatchComplete(batch);

      // Assert
      expect(result).toBe(false);
    });

    it("should_return_true_when_max_runs_reached_even_if_target_not_met", async () => {
      // Arrange
      const { isBatchComplete } = await import("@/lib/eval/score-batches");
      const batch = {
        targetRuns: 5, // Drift increased target
        completedRuns: 3,
        failedRuns: 2, // 3 + 2 = 5 = maxRuns
        maxRuns: 5,
      };

      // Act
      const result = isBatchComplete(batch);

      // Assert
      expect(result).toBe(true);
    });
  });
});
