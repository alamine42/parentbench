import fs from "fs/promises";
import path from "path";
import { cache } from "react";
import type {
  ParentBenchScoresData,
  ParentBenchResult,
  ParentBenchMethodology,
  ParentBenchTestCasesData,
  ParentBenchTestCase,
} from "@/types/parentbench";

/**
 * Cached loader for ParentBench scores data.
 * Uses React's cache() to dedupe reads within a single request.
 */
const loadScoresData = cache(async (): Promise<ParentBenchScoresData> => {
  const filePath = path.join(
    process.cwd(),
    "data",
    "parentbench",
    "scores.json"
  );
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as ParentBenchScoresData;
});

/**
 * Cached loader for ParentBench methodology data.
 */
const loadMethodologyData = cache(async (): Promise<ParentBenchMethodology> => {
  const filePath = path.join(
    process.cwd(),
    "data",
    "parentbench",
    "methodology.json"
  );
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as ParentBenchMethodology;
});

/**
 * Cached loader for ParentBench test cases data.
 */
const loadTestCasesData = cache(async (): Promise<ParentBenchTestCasesData> => {
  const filePath = path.join(
    process.cwd(),
    "data",
    "parentbench",
    "test-cases.json"
  );
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as ParentBenchTestCasesData;
});

/**
 * Get all ParentBench scores, sorted by overall score descending.
 * Uses stable sorting with modelSlug as tie-breaker.
 * Returns a defensive copy to prevent mutation of cached data.
 */
export async function getParentBenchScores(): Promise<ParentBenchResult[]> {
  const data = await loadScoresData();
  // Create defensive copy to prevent mutation of cached data
  return [...data.results].sort((a, b) => {
    const scoreDiff = b.overallScore - a.overallScore;
    if (scoreDiff !== 0) return scoreDiff;
    // Tie-breaker: alphabetical by modelSlug for stable ranking
    return a.modelSlug.localeCompare(b.modelSlug);
  });
}

/**
 * Get ParentBench score for a specific model by slug
 */
export async function getParentBenchScoreBySlug(
  slug: string
): Promise<ParentBenchResult | null> {
  const scores = await getParentBenchScores();
  return scores.find((s) => s.modelSlug === slug) ?? null;
}

/**
 * Get the ParentBench methodology documentation
 */
export async function getParentBenchMethodology(): Promise<ParentBenchMethodology> {
  return loadMethodologyData();
}

/**
 * Get all ParentBench test cases (for methodology display)
 * Returns a defensive copy to prevent mutation of cached data.
 */
export async function getParentBenchTestCases(): Promise<ParentBenchTestCase[]> {
  const data = await loadTestCasesData();
  return [...data.testCases];
}

/**
 * Compute the rank position of a model in ParentBench leaderboard
 * Returns 1-indexed rank (1 = best)
 */
export async function computeParentBenchRank(slug: string): Promise<number | null> {
  const scores = await getParentBenchScores(); // Already sorted desc with stable tie-breaker
  const index = scores.findIndex((s) => s.modelSlug === slug);
  return index === -1 ? null : index + 1;
}

/**
 * Get total number of models evaluated in ParentBench
 */
export async function getParentBenchModelCount(): Promise<number> {
  const data = await loadScoresData();
  return data.results.length;
}

/**
 * Get ParentBench last updated date.
 * Returns the most recent update date across scores, methodology, and test cases.
 */
export async function getParentBenchLastUpdated(): Promise<string> {
  const [scoresData, methodologyData, testCasesData] = await Promise.all([
    loadScoresData(),
    loadMethodologyData(),
    loadTestCasesData(),
  ]);

  const dates = [
    scoresData.lastUpdated,
    methodologyData.lastUpdated,
    testCasesData.lastUpdated,
  ];

  // Return the most recent date
  return dates.sort().reverse()[0];
}
