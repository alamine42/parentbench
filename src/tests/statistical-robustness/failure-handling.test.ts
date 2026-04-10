/**
 * Failure Handling Tests
 *
 * Tests for batch failure scenarios including:
 * - Run failure tracking
 * - Retry logic
 * - Batch failure state
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { _clearBatches, _setTestSuiteHash } from "@/lib/eval/score-batches";

describe("Failure Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _clearBatches();
    _setTestSuiteHash("abc123def456789012345678901234567890123456789012345678901234abcd");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _clearBatches();
  });

  describe("handleRunFailure", () => {
    it("should_increment_failed_runs_count", async () => {
      // Arrange
      const { handleRunFailure, createScoreBatch } = await import("@/lib/eval/score-batches");
      const batch = await createScoreBatch("model-123", "manual");

      // Act
      const updated = await handleRunFailure(batch.id, "API timeout");

      // Assert
      expect(updated.failedRuns).toBe(1);
    });

    it("should_store_last_error_message", async () => {
      // Arrange
      const { handleRunFailure, createScoreBatch } = await import("@/lib/eval/score-batches");
      const batch = await createScoreBatch("model-123", "manual");
      const errorMessage = "Connection refused to model API";

      // Act
      const updated = await handleRunFailure(batch.id, errorMessage);

      // Assert
      expect(updated.lastError).toBe(errorMessage);
    });

    it("should_increment_retry_count", async () => {
      // Arrange
      const { handleRunFailure, createScoreBatch } = await import("@/lib/eval/score-batches");
      const batch = await createScoreBatch("model-123", "manual");

      // Act
      await handleRunFailure(batch.id, "Error 1");
      const updated = await handleRunFailure(batch.id, "Error 2");

      // Assert
      expect(updated.retryCount).toBe(2);
    });
  });

  describe("shouldRetry", () => {
    it("should_return_true_when_under_max_retries", async () => {
      // Arrange
      const { shouldRetry } = await import("@/lib/eval/score-batches");
      const batch = {
        retryCount: 1,
        maxRetries: 3,
      };

      // Act
      const result = shouldRetry(batch);

      // Assert
      expect(result).toBe(true);
    });

    it("should_return_false_when_at_max_retries", async () => {
      // Arrange
      const { shouldRetry } = await import("@/lib/eval/score-batches");
      const batch = {
        retryCount: 3,
        maxRetries: 3,
      };

      // Act
      const result = shouldRetry(batch);

      // Assert
      expect(result).toBe(false);
    });

    it("should_return_false_when_over_max_retries", async () => {
      // Arrange
      const { shouldRetry } = await import("@/lib/eval/score-batches");
      const batch = {
        retryCount: 5,
        maxRetries: 3,
      };

      // Act
      const result = shouldRetry(batch);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("markBatchFailed", () => {
    it("should_set_status_to_failed", async () => {
      // Arrange
      const { markBatchFailed, createScoreBatch } = await import("@/lib/eval/score-batches");
      const batch = await createScoreBatch("model-123", "manual");

      // Act
      const updated = await markBatchFailed(batch.id, "Max retries exceeded");

      // Assert
      expect(updated.status).toBe("failed");
    });

    it("should_set_completed_at_timestamp", async () => {
      // Arrange
      const { markBatchFailed, createScoreBatch } = await import("@/lib/eval/score-batches");
      const batch = await createScoreBatch("model-123", "manual");
      const beforeMark = new Date();

      // Act
      const updated = await markBatchFailed(batch.id, "Error");

      // Assert
      expect(updated.completedAt).toBeDefined();
      expect(new Date(updated.completedAt!).getTime()).toBeGreaterThanOrEqual(beforeMark.getTime());
    });

    it("should_preserve_error_message", async () => {
      // Arrange
      const { markBatchFailed, createScoreBatch } = await import("@/lib/eval/score-batches");
      const batch = await createScoreBatch("model-123", "manual");
      const errorMessage = "All retries exhausted: Connection timeout";

      // Act
      const updated = await markBatchFailed(batch.id, errorMessage);

      // Assert
      expect(updated.lastError).toBe(errorMessage);
    });
  });

  describe("Batch Failure Conditions", () => {
    it("should_fail_batch_when_all_runs_fail", async () => {
      // Arrange
      const { handleRunFailure, getBatch, createScoreBatch } = await import("@/lib/eval/score-batches");
      const batch = await createScoreBatch("model-123", "manual");

      // Simulate 3 failed runs with 3 retries each = 9 total failures
      for (let i = 0; i < 9; i++) {
        await handleRunFailure(batch.id, `Failure ${i + 1}`);
      }

      // Act
      const finalBatch = await getBatch(batch.id);

      // Assert
      expect(finalBatch.status).toBe("failed");
    });

    it("should_not_fail_batch_when_some_runs_succeed", async () => {
      // Arrange
      const {
        handleRunFailure,
        updateBatchProgress,
        getBatch,
        createScoreBatch
      } = await import("@/lib/eval/score-batches");
      const batch = await createScoreBatch("model-123", "manual");

      // 2 successful runs
      await updateBatchProgress(batch.id, { success: true, score: 80 });
      await updateBatchProgress(batch.id, { success: true, score: 82 });

      // 1 failed run (with retries exhausted)
      for (let i = 0; i < 3; i++) {
        await handleRunFailure(batch.id, "API error");
      }

      // Act
      const finalBatch = await getBatch(batch.id);

      // Assert
      expect(finalBatch.status).not.toBe("failed");
      expect(finalBatch.completedRuns).toBe(2);
    });
  });

  describe("Retry Queue", () => {
    it("should_queue_retry_with_exponential_backoff", async () => {
      // Arrange
      const { calculateRetryDelay } = await import("@/lib/eval/score-batches");

      // Act & Assert
      expect(calculateRetryDelay(0)).toBe(1000); // 1 second
      expect(calculateRetryDelay(1)).toBe(2000); // 2 seconds
      expect(calculateRetryDelay(2)).toBe(4000); // 4 seconds
    });

    it("should_cap_retry_delay_at_maximum", async () => {
      // Arrange
      const { calculateRetryDelay } = await import("@/lib/eval/score-batches");

      // Act
      const delay = calculateRetryDelay(10); // Very high retry count

      // Assert
      expect(delay).toBeLessThanOrEqual(30000); // Max 30 seconds
    });
  });

  describe("Partial Batch Completion", () => {
    it("should_compute_score_from_completed_runs_only", async () => {
      // Arrange
      const {
        finalizeBatch,
        createScoreBatch,
        updateBatchProgress,
        handleRunFailure
      } = await import("@/lib/eval/score-batches");

      const batch = await createScoreBatch("model-123", "manual");

      // 2 successful, 1 failed (3 retries exhausted)
      await updateBatchProgress(batch.id, { success: true, score: 80 });
      await updateBatchProgress(batch.id, { success: true, score: 82 });
      for (let i = 0; i < 3; i++) {
        await handleRunFailure(batch.id, "Error");
      }

      // Act
      const result = await finalizeBatch(batch.id);

      // Assert
      expect(result.medianScore).toBe(81); // Median of [80, 82]
      expect(result.completedRuns).toBe(2);
      expect(result.status).toBe("completed"); // Partial success is still completion
    });

    it("should_mark_confidence_as_low_for_partial_batch", async () => {
      // Arrange
      const {
        finalizeBatch,
        createScoreBatch,
        updateBatchProgress,
        handleRunFailure
      } = await import("@/lib/eval/score-batches");

      const batch = await createScoreBatch("model-123", "manual");

      // Only 2 of 3 runs completed
      await updateBatchProgress(batch.id, { success: true, score: 80 });
      await updateBatchProgress(batch.id, { success: true, score: 82 });
      for (let i = 0; i < 3; i++) {
        await handleRunFailure(batch.id, "Error");
      }

      // Act
      const result = await finalizeBatch(batch.id);

      // Assert
      // Variance is low (2 points) but incomplete batch should flag this
      expect(result.isPartial).toBe(true);
    });
  });
});
