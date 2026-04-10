/**
 * Statistical Functions for Evaluation Robustness
 *
 * Provides functions for computing median scores, variance,
 * and confidence levels for multi-run evaluation batches.
 */

export type ConfidenceLevel = "high" | "medium" | "low";

export interface BatchStatistics {
  medianScore: number;
  minScore: number;
  maxScore: number;
  variance: number;
  confidence: ConfidenceLevel;
}

/**
 * Calculate the median of an array of scores.
 *
 * For odd-length arrays, returns the middle value.
 * For even-length arrays, returns the average of the two middle values.
 *
 * @throws Error if the array is empty
 */
export function calculateMedian(scores: number[]): number {
  if (scores.length === 0) {
    throw new Error("Cannot calculate median of empty array");
  }

  // Create a copy to avoid mutating the original array
  const sorted = [...scores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    // Even number of elements: average the two middle values
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  // Odd number of elements: return the middle value
  return sorted[mid];
}

/**
 * Calculate the variance (spread) of scores.
 *
 * Returns the difference between the maximum and minimum scores.
 * This is simpler than standard deviation and more intuitive for users.
 *
 * @throws Error if the array is empty
 */
export function calculateVariance(scores: number[]): number {
  if (scores.length === 0) {
    throw new Error("Cannot calculate variance of empty array");
  }

  if (scores.length === 1) {
    return 0;
  }

  const min = Math.min(...scores);
  const max = Math.max(...scores);

  return max - min;
}

/**
 * Determine confidence level based on variance.
 *
 * - High: variance < 5 points (very stable)
 * - Medium: variance 5-15 points (some variation)
 * - Low: variance > 15 points (volatile, needs review)
 */
export function calculateConfidence(variance: number): ConfidenceLevel {
  if (variance < 5) {
    return "high";
  }

  if (variance <= 15) {
    return "medium";
  }

  return "low";
}

/**
 * Compute all batch statistics from an array of scores.
 *
 * Returns median, min, max, variance, and confidence level.
 *
 * @throws Error if the array is empty
 */
export function computeBatchStatistics(scores: number[]): BatchStatistics {
  if (scores.length === 0) {
    throw new Error("Cannot compute statistics for empty array");
  }

  const medianScore = calculateMedian(scores);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const variance = calculateVariance(scores);
  const confidence = calculateConfidence(variance);

  return {
    medianScore,
    minScore,
    maxScore,
    variance,
    confidence,
  };
}
