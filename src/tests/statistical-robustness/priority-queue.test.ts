/**
 * Priority Queue Tests
 *
 * Tests for evaluation queue priorities including:
 * - Tier-based priority ordering
 * - Concurrency limits
 * - Same-model serialization
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { _clearModelLocks } from "@/lib/eval/priority-queue";

describe("Priority Queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _clearModelLocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _clearModelLocks();
  });

  describe("getPriorityForTier", () => {
    it("should_return_1_for_active_tier", async () => {
      // Arrange
      const { getPriorityForTier } = await import("@/lib/eval/priority-queue");

      // Act
      const priority = getPriorityForTier("active");

      // Assert
      expect(priority).toBe(1);
    });

    it("should_return_2_for_standard_tier", async () => {
      // Arrange
      const { getPriorityForTier } = await import("@/lib/eval/priority-queue");

      // Act
      const priority = getPriorityForTier("standard");

      // Assert
      expect(priority).toBe(2);
    });

    it("should_return_3_for_maintenance_tier", async () => {
      // Arrange
      const { getPriorityForTier } = await import("@/lib/eval/priority-queue");

      // Act
      const priority = getPriorityForTier("maintenance");

      // Assert
      expect(priority).toBe(3);
    });

    it("should_return_4_for_manual_trigger", async () => {
      // Arrange
      const { getPriorityForTier } = await import("@/lib/eval/priority-queue");

      // Act
      const priority = getPriorityForTier("paused"); // Manual triggers use paused tier

      // Assert
      expect(priority).toBe(4);
    });
  });

  describe("sortByPriority", () => {
    it("should_sort_active_before_standard", async () => {
      // Arrange
      const { sortByPriority } = await import("@/lib/eval/priority-queue");
      const jobs = [
        { id: "1", tier: "standard" as const, modelId: "m1" },
        { id: "2", tier: "active" as const, modelId: "m2" },
        { id: "3", tier: "maintenance" as const, modelId: "m3" },
      ];

      // Act
      const sorted = sortByPriority(jobs);

      // Assert
      expect(sorted[0].tier).toBe("active");
      expect(sorted[1].tier).toBe("standard");
      expect(sorted[2].tier).toBe("maintenance");
    });

    it("should_maintain_order_within_same_priority", async () => {
      // Arrange
      const { sortByPriority } = await import("@/lib/eval/priority-queue");
      const jobs = [
        { id: "1", tier: "active" as const, modelId: "m1", createdAt: new Date("2026-01-01") },
        { id: "2", tier: "active" as const, modelId: "m2", createdAt: new Date("2026-01-02") },
      ];

      // Act
      const sorted = sortByPriority(jobs);

      // Assert - FIFO within same priority
      expect(sorted[0].id).toBe("1");
      expect(sorted[1].id).toBe("2");
    });
  });

  describe("canStartEvaluation", () => {
    it("should_return_true_when_under_concurrency_limit", async () => {
      // Arrange
      const { canStartEvaluation } = await import("@/lib/eval/priority-queue");
      const currentlyRunning = 3;
      const limit = 5;

      // Act
      const canStart = canStartEvaluation(currentlyRunning, limit);

      // Assert
      expect(canStart).toBe(true);
    });

    it("should_return_false_when_at_concurrency_limit", async () => {
      // Arrange
      const { canStartEvaluation } = await import("@/lib/eval/priority-queue");
      const currentlyRunning = 5;
      const limit = 5;

      // Act
      const canStart = canStartEvaluation(currentlyRunning, limit);

      // Assert
      expect(canStart).toBe(false);
    });

    it("should_return_false_when_over_concurrency_limit", async () => {
      // Arrange
      const { canStartEvaluation } = await import("@/lib/eval/priority-queue");
      const currentlyRunning = 6;
      const limit = 5;

      // Act
      const canStart = canStartEvaluation(currentlyRunning, limit);

      // Assert
      expect(canStart).toBe(false);
    });
  });

  describe("isModelLocked", () => {
    it("should_return_true_when_model_has_running_evaluation", async () => {
      // Arrange
      const { isModelLocked, lockModel } = await import("@/lib/eval/priority-queue");
      const modelId = "model-123";

      // Lock the model
      await lockModel(modelId);

      // Act
      const locked = await isModelLocked(modelId);

      // Assert
      expect(locked).toBe(true);
    });

    it("should_return_false_when_model_is_free", async () => {
      // Arrange
      const { isModelLocked } = await import("@/lib/eval/priority-queue");
      const modelId = "model-free";

      // Act
      const locked = await isModelLocked(modelId);

      // Assert
      expect(locked).toBe(false);
    });

    it("should_return_false_after_unlock", async () => {
      // Arrange
      const { isModelLocked, lockModel, unlockModel } = await import("@/lib/eval/priority-queue");
      const modelId = "model-123";

      await lockModel(modelId);
      await unlockModel(modelId);

      // Act
      const locked = await isModelLocked(modelId);

      // Assert
      expect(locked).toBe(false);
    });
  });

  describe("Queue Order", () => {
    it("should_process_active_tier_first_even_if_queued_later", async () => {
      // Arrange
      const { createQueue, enqueue, dequeue } = await import("@/lib/eval/priority-queue");
      const queue = createQueue();

      // Enqueue in wrong order
      enqueue(queue, { id: "1", tier: "maintenance" as const, modelId: "m1" });
      enqueue(queue, { id: "2", tier: "standard" as const, modelId: "m2" });
      enqueue(queue, { id: "3", tier: "active" as const, modelId: "m3" });

      // Act
      const first = dequeue(queue);
      const second = dequeue(queue);
      const third = dequeue(queue);

      // Assert
      expect(first?.tier).toBe("active");
      expect(second?.tier).toBe("standard");
      expect(third?.tier).toBe("maintenance");
    });

    it("should_skip_locked_models_in_queue", async () => {
      // Arrange
      const { createQueue, enqueue, dequeueNext, lockModel } = await import("@/lib/eval/priority-queue");
      const queue = createQueue();

      enqueue(queue, { id: "1", tier: "active" as const, modelId: "m1" });
      enqueue(queue, { id: "2", tier: "active" as const, modelId: "m2" });

      // Lock first model
      await lockModel("m1");

      // Act
      const next = await dequeueNext(queue);

      // Assert - Should skip m1 and return m2
      expect(next?.modelId).toBe("m2");
    });
  });

  describe("Inngest Priority Config", () => {
    it("should_generate_correct_inngest_priority_config", async () => {
      // Arrange
      const { getInngestPriorityConfig } = await import("@/lib/eval/priority-queue");

      // Act
      const config = getInngestPriorityConfig();

      // Assert
      expect(config).toEqual({
        concurrency: {
          limit: 5,
          key: "event.data.modelId",
        },
        priority: {
          run: "event.data.priority",
        },
      });
    });
  });
});
