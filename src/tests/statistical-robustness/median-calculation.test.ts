/**
 * Median Calculation Tests
 *
 * Tests for computing batch scores including:
 * - Median calculation from runs
 * - Variance and confidence levels
 * - Handling outliers
 */

import { describe, it, expect } from "vitest";

describe("Median Calculation", () => {
  describe("calculateMedian", () => {
    it("should_return_middle_value_for_3_scores", async () => {
      // Arrange
      const { calculateMedian } = await import("@/lib/eval/statistics");
      const scores = [72, 68, 85];

      // Act
      const median = calculateMedian(scores);

      // Assert
      expect(median).toBe(72); // Sorted: [68, 72, 85] -> middle is 72
    });

    it("should_return_middle_value_for_5_scores", async () => {
      // Arrange
      const { calculateMedian } = await import("@/lib/eval/statistics");
      const scores = [60, 75, 90, 55, 80];

      // Act
      const median = calculateMedian(scores);

      // Assert
      expect(median).toBe(75); // Sorted: [55, 60, 75, 80, 90] -> middle is 75
    });

    it("should_return_average_of_middle_two_for_even_count", async () => {
      // Arrange
      const { calculateMedian } = await import("@/lib/eval/statistics");
      const scores = [70, 80, 60, 90];

      // Act
      const median = calculateMedian(scores);

      // Assert
      expect(median).toBe(75); // Sorted: [60, 70, 80, 90] -> (70+80)/2 = 75
    });

    it("should_handle_single_score", async () => {
      // Arrange
      const { calculateMedian } = await import("@/lib/eval/statistics");
      const scores = [85];

      // Act
      const median = calculateMedian(scores);

      // Assert
      expect(median).toBe(85);
    });

    it("should_throw_for_empty_array", async () => {
      // Arrange
      const { calculateMedian } = await import("@/lib/eval/statistics");
      const scores: number[] = [];

      // Act & Assert
      expect(() => calculateMedian(scores)).toThrow("Cannot calculate median of empty array");
    });

    it("should_not_modify_original_array", async () => {
      // Arrange
      const { calculateMedian } = await import("@/lib/eval/statistics");
      const scores = [85, 72, 68];
      const originalOrder = [...scores];

      // Act
      calculateMedian(scores);

      // Assert
      expect(scores).toEqual(originalOrder);
    });
  });

  describe("calculateVariance", () => {
    it("should_return_difference_between_max_and_min", async () => {
      // Arrange
      const { calculateVariance } = await import("@/lib/eval/statistics");
      const scores = [68, 72, 85];

      // Act
      const variance = calculateVariance(scores);

      // Assert
      expect(variance).toBe(17); // 85 - 68 = 17
    });

    it("should_return_0_for_identical_scores", async () => {
      // Arrange
      const { calculateVariance } = await import("@/lib/eval/statistics");
      const scores = [80, 80, 80];

      // Act
      const variance = calculateVariance(scores);

      // Assert
      expect(variance).toBe(0);
    });

    it("should_handle_single_score", async () => {
      // Arrange
      const { calculateVariance } = await import("@/lib/eval/statistics");
      const scores = [85];

      // Act
      const variance = calculateVariance(scores);

      // Assert
      expect(variance).toBe(0);
    });

    it("should_throw_for_empty_array", async () => {
      // Arrange
      const { calculateVariance } = await import("@/lib/eval/statistics");
      const scores: number[] = [];

      // Act & Assert
      expect(() => calculateVariance(scores)).toThrow("Cannot calculate variance of empty array");
    });
  });

  describe("calculateConfidence", () => {
    it("should_return_high_when_variance_less_than_5", async () => {
      // Arrange
      const { calculateConfidence } = await import("@/lib/eval/statistics");

      // Act & Assert
      expect(calculateConfidence(0)).toBe("high");
      expect(calculateConfidence(2)).toBe("high");
      expect(calculateConfidence(4.9)).toBe("high");
    });

    it("should_return_medium_when_variance_between_5_and_15", async () => {
      // Arrange
      const { calculateConfidence } = await import("@/lib/eval/statistics");

      // Act & Assert
      expect(calculateConfidence(5)).toBe("medium");
      expect(calculateConfidence(10)).toBe("medium");
      expect(calculateConfidence(15)).toBe("medium");
    });

    it("should_return_low_when_variance_greater_than_15", async () => {
      // Arrange
      const { calculateConfidence } = await import("@/lib/eval/statistics");

      // Act & Assert
      expect(calculateConfidence(15.1)).toBe("low");
      expect(calculateConfidence(20)).toBe("low");
      expect(calculateConfidence(50)).toBe("low");
    });
  });

  describe("computeBatchStatistics", () => {
    it("should_compute_median_variance_and_confidence_together", async () => {
      // Arrange
      const { computeBatchStatistics } = await import("@/lib/eval/statistics");
      const scores = [72, 68, 85];

      // Act
      const stats = computeBatchStatistics(scores);

      // Assert
      expect(stats.medianScore).toBe(72);
      expect(stats.minScore).toBe(68);
      expect(stats.maxScore).toBe(85);
      expect(stats.variance).toBe(17);
      expect(stats.confidence).toBe("low"); // 17 > 15
    });

    it("should_handle_high_confidence_batch", async () => {
      // Arrange
      const { computeBatchStatistics } = await import("@/lib/eval/statistics");
      const scores = [82, 83, 84];

      // Act
      const stats = computeBatchStatistics(scores);

      // Assert
      expect(stats.medianScore).toBe(83);
      expect(stats.variance).toBe(2);
      expect(stats.confidence).toBe("high");
    });

    it("should_handle_medium_confidence_batch", async () => {
      // Arrange
      const { computeBatchStatistics } = await import("@/lib/eval/statistics");
      const scores = [75, 80, 85];

      // Act
      const stats = computeBatchStatistics(scores);

      // Assert
      expect(stats.medianScore).toBe(80);
      expect(stats.variance).toBe(10);
      expect(stats.confidence).toBe("medium");
    });
  });

  describe("Outlier Handling", () => {
    it("should_not_be_affected_by_outlier_when_using_median", async () => {
      // Arrange
      const { computeBatchStatistics } = await import("@/lib/eval/statistics");
      const scoresWithOutlier = [80, 82, 30]; // 30 is an outlier

      // Act
      const stats = computeBatchStatistics(scoresWithOutlier);

      // Assert
      expect(stats.medianScore).toBe(80); // Median ignores outlier
      // But variance will be high
      expect(stats.variance).toBe(52); // 82 - 30
      expect(stats.confidence).toBe("low");
    });

    it("should_prefer_median_over_mean_for_robustness", async () => {
      // Arrange
      const { calculateMedian } = await import("@/lib/eval/statistics");
      const scores = [80, 82, 30];

      // Act
      const median = calculateMedian(scores);
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;

      // Assert
      expect(median).toBe(80); // Robust to outlier
      expect(mean).toBeCloseTo(64); // Mean is pulled down by outlier
      expect(median).toBeGreaterThan(mean);
    });
  });
});
