/**
 * Migration Tests
 *
 * Tests for migrating existing scores to new batch system including:
 * - Legacy score marking
 * - UI handling of legacy scores
 * - Gradual backfill
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { _clearMigrationData } from "@/lib/eval/migration";

describe("Migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _clearMigrationData();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _clearMigrationData();
  });

  describe("markLegacyScores", () => {
    it("should_set_confidence_to_legacy_for_scores_without_batch", async () => {
      // Arrange
      const { markLegacyScores, getScore } = await import("@/lib/eval/migration");
      const scoreId = "score-without-batch";

      // Act
      await markLegacyScores();
      const score = await getScore(scoreId);

      // Assert
      expect(score.confidence).toBe("legacy");
    });

    it("should_not_modify_scores_with_existing_batch", async () => {
      // Arrange
      const { markLegacyScores, getScore } = await import("@/lib/eval/migration");
      const scoreId = "score-with-batch";

      // Act
      await markLegacyScores();
      const score = await getScore(scoreId);

      // Assert
      expect(score.confidence).not.toBe("legacy");
      expect(score.scoreBatchId).toBeDefined();
    });

    it("should_return_count_of_marked_scores", async () => {
      // Arrange
      const { markLegacyScores } = await import("@/lib/eval/migration");

      // Act
      const result = await markLegacyScores();

      // Assert
      expect(typeof result.markedCount).toBe("number");
      expect(result.markedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("isLegacyScore", () => {
    it("should_return_true_for_score_with_legacy_confidence", async () => {
      // Arrange
      const { isLegacyScore } = await import("@/lib/eval/migration");
      const score = { confidence: "legacy" as const };

      // Act
      const result = isLegacyScore(score);

      // Assert
      expect(result).toBe(true);
    });

    it("should_return_true_for_score_without_batch_id", async () => {
      // Arrange
      const { isLegacyScore } = await import("@/lib/eval/migration");
      const score = { confidence: null, scoreBatchId: null };

      // Act
      const result = isLegacyScore(score);

      // Assert
      expect(result).toBe(true);
    });

    it("should_return_false_for_score_with_batch_id", async () => {
      // Arrange
      const { isLegacyScore } = await import("@/lib/eval/migration");
      const score = { confidence: "high" as const, scoreBatchId: "batch-123" };

      // Act
      const result = isLegacyScore(score);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("getLegacyScoreDisplayText", () => {
    it("should_return_dash_for_confidence_indicator", async () => {
      // Arrange
      const { getLegacyScoreDisplayText } = await import("@/lib/eval/migration");

      // Act
      const text = getLegacyScoreDisplayText("confidence");

      // Assert
      expect(text).toBe("—");
    });

    it("should_return_helpful_tooltip_for_variance", async () => {
      // Arrange
      const { getLegacyScoreDisplayText } = await import("@/lib/eval/migration");

      // Act
      const text = getLegacyScoreDisplayText("variance");

      // Assert
      expect(text).toBe("Single-run score (legacy)");
    });
  });

  describe("Schema Migration", () => {
    it("should_add_variance_column_with_null_default", async () => {
      // Arrange
      const { getSchemaInfo } = await import("@/lib/eval/migration");

      // Act
      const schema = await getSchemaInfo("scores");

      // Assert
      expect(schema.columns).toContainEqual(
        expect.objectContaining({
          name: "variance",
          type: "real",
          nullable: true,
        })
      );
    });

    it("should_add_confidence_column_with_legacy_default", async () => {
      // Arrange
      const { getSchemaInfo } = await import("@/lib/eval/migration");

      // Act
      const schema = await getSchemaInfo("scores");

      // Assert
      expect(schema.columns).toContainEqual(
        expect.objectContaining({
          name: "confidence",
          type: "text",
          nullable: true,
        })
      );
    });

    it("should_add_score_batch_id_column", async () => {
      // Arrange
      const { getSchemaInfo } = await import("@/lib/eval/migration");

      // Act
      const schema = await getSchemaInfo("scores");

      // Assert
      expect(schema.columns).toContainEqual(
        expect.objectContaining({
          name: "score_batch_id",
          type: "uuid",
          nullable: true,
        })
      );
    });

    it("should_create_score_batches_table", async () => {
      // Arrange
      const { tableExists } = await import("@/lib/eval/migration");

      // Act
      const exists = await tableExists("score_batches");

      // Assert
      expect(exists).toBe(true);
    });
  });

  describe("Backfill Strategy", () => {
    it("should_create_batch_on_next_scheduled_eval", async () => {
      // Arrange
      const { triggerEvaluation, getBatchForModel } = await import("@/lib/eval/migration");
      const modelId = "model-with-legacy-score";

      // Act
      await triggerEvaluation(modelId, "scheduled");
      const batch = await getBatchForModel(modelId);

      // Assert
      expect(batch).toBeDefined();
      expect(batch!.status).toBe("pending");
    });

    it("should_not_create_duplicate_batches_for_same_model", async () => {
      // Arrange
      const { triggerEvaluation, getActiveBatchesForModel } = await import("@/lib/eval/migration");
      const modelId = "model-123";

      // Act
      await triggerEvaluation(modelId, "scheduled");
      await triggerEvaluation(modelId, "scheduled");
      const batches = await getActiveBatchesForModel(modelId);

      // Assert
      expect(batches.length).toBe(1);
    });
  });
});
