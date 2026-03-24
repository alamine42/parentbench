import fs from "fs/promises";
import path from "path";
import { cache } from "react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { models, scores, testCases, categories } from "@/db/schema";
import type {
  ParentBenchScoresData,
  ParentBenchResult,
  ParentBenchMethodology,
  ParentBenchTestCasesData,
  ParentBenchTestCase,
  ParentBenchCategoryScore,
  ParentBenchCategory,
} from "@/types/parentbench";
import type { LetterGrade, TrendDirection, DataQuality } from "@/types/model";

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Custom error class for data loading failures.
 * Provides context about which file failed to load.
 */
export class DataLoadError extends Error {
  constructor(
    public readonly fileName: string,
    public readonly cause: unknown
  ) {
    const message = `Failed to load ${fileName}: ${cause instanceof Error ? cause.message : String(cause)}`;
    super(message);
    this.name = "DataLoadError";
  }
}

/**
 * Helper to safely read and parse JSON files with error handling.
 */
async function safeReadJson<T>(filePath: string, fileName: string): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`[ParentBench] Error loading ${fileName}:`, error);
    throw new DataLoadError(fileName, error);
  }
}

// ============================================================================
// DATABASE LOADERS (PRIMARY)
// ============================================================================

/**
 * Load scores from database with model joins.
 * Returns results sorted by overall score descending.
 */
const loadScoresFromDB = cache(async (): Promise<ParentBenchResult[]> => {
  try {
    // Get the most recent score for each model
    const dbScores = await db
      .select({
        modelSlug: models.slug,
        overallScore: scores.overallScore,
        overallGrade: scores.overallGrade,
        trend: scores.trend,
        dataQuality: scores.dataQuality,
        categoryScores: scores.categoryScores,
        evaluatedDate: scores.computedAt,
      })
      .from(scores)
      .innerJoin(models, eq(scores.modelId, models.id))
      .orderBy(desc(scores.computedAt));

    // Group by model, keeping only the most recent score
    const latestByModel = new Map<string, typeof dbScores[0]>();
    for (const score of dbScores) {
      if (!latestByModel.has(score.modelSlug)) {
        latestByModel.set(score.modelSlug, score);
      }
    }

    // Transform to ParentBenchResult format
    return Array.from(latestByModel.values()).map((row) => ({
      modelSlug: row.modelSlug,
      overallScore: row.overallScore,
      overallGrade: row.overallGrade as LetterGrade,
      trend: row.trend as TrendDirection,
      categoryScores: (row.categoryScores as ParentBenchCategoryScore[]) ?? [],
      evaluatedDate: row.evaluatedDate
        ? row.evaluatedDate.toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      dataQuality: row.dataQuality as DataQuality,
      methodologyVersion: "1.0.0",
    }));
  } catch (error) {
    console.error("[ParentBench] DB scores load failed:", error);
    throw error;
  }
});

/**
 * Load test cases from database with category joins.
 */
const loadTestCasesFromDB = cache(async (): Promise<ParentBenchTestCase[]> => {
  try {
    const dbTestCases = await db
      .select({
        id: testCases.id,
        category: categories.name,
        prompt: testCases.prompt,
        expectedBehavior: testCases.expectedBehavior,
        severity: testCases.severity,
        description: testCases.description,
      })
      .from(testCases)
      .innerJoin(categories, eq(testCases.categoryId, categories.id))
      .where(eq(testCases.isActive, true));

    return dbTestCases.map((row) => ({
      id: row.id,
      category: row.category as ParentBenchCategory,
      prompt: row.prompt,
      expectedBehavior: row.expectedBehavior as "refuse" | "safe_response" | "redirect",
      severity: row.severity as "critical" | "high" | "medium",
      description: row.description,
    }));
  } catch (error) {
    console.error("[ParentBench] DB test cases load failed:", error);
    throw error;
  }
});

// ============================================================================
// JSON FALLBACK LOADERS
// ============================================================================

/**
 * Cached loader for ParentBench scores from JSON (fallback).
 */
const loadScoresFromJSON = cache(async (): Promise<ParentBenchScoresData> => {
  const filePath = path.join(
    process.cwd(),
    "data",
    "parentbench",
    "scores.json"
  );
  return safeReadJson<ParentBenchScoresData>(filePath, "scores.json");
});

/**
 * Cached loader for ParentBench methodology from JSON.
 * Methodology is static documentation, always loaded from JSON.
 */
const loadMethodologyData = cache(async (): Promise<ParentBenchMethodology> => {
  const filePath = path.join(
    process.cwd(),
    "data",
    "parentbench",
    "methodology.json"
  );
  return safeReadJson<ParentBenchMethodology>(filePath, "methodology.json");
});

/**
 * Cached loader for ParentBench test cases from JSON (fallback).
 */
const loadTestCasesFromJSON = cache(async (): Promise<ParentBenchTestCasesData> => {
  const filePath = path.join(
    process.cwd(),
    "data",
    "parentbench",
    "test-cases.json"
  );
  return safeReadJson<ParentBenchTestCasesData>(filePath, "test-cases.json");
});

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get all ParentBench scores, sorted by overall score descending.
 * Uses database as primary source with JSON fallback.
 * Returns a defensive copy sorted with stable tie-breaker.
 */
export async function getParentBenchScores(): Promise<ParentBenchResult[]> {
  let results: ParentBenchResult[];

  try {
    // Try database first
    results = await loadScoresFromDB();

    // If DB returned no results, fall back to JSON
    if (results.length === 0) {
      console.warn("[ParentBench] No scores in DB, falling back to JSON");
      const data = await loadScoresFromJSON();
      results = [...data.results];
    }
  } catch {
    // Fall back to JSON on any DB error
    console.warn("[ParentBench] DB unavailable, falling back to JSON");
    const data = await loadScoresFromJSON();
    results = [...data.results];
  }

  // Sort by score descending with modelSlug as stable tie-breaker
  return results.sort((a, b) => {
    const scoreDiff = b.overallScore - a.overallScore;
    if (scoreDiff !== 0) return scoreDiff;
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
 * Get the ParentBench methodology documentation.
 * Always loaded from JSON (static documentation).
 */
export async function getParentBenchMethodology(): Promise<ParentBenchMethodology> {
  return loadMethodologyData();
}

/**
 * Get all ParentBench test cases.
 * Uses database as primary source with JSON fallback.
 * Returns a defensive copy.
 */
export async function getParentBenchTestCases(): Promise<ParentBenchTestCase[]> {
  try {
    // Try database first
    const testCases = await loadTestCasesFromDB();

    // If DB returned no results, fall back to JSON
    if (testCases.length === 0) {
      console.warn("[ParentBench] No test cases in DB, falling back to JSON");
      const data = await loadTestCasesFromJSON();
      return [...data.testCases];
    }

    return testCases;
  } catch {
    // Fall back to JSON on any DB error
    console.warn("[ParentBench] DB unavailable for test cases, falling back to JSON");
    const data = await loadTestCasesFromJSON();
    return [...data.testCases];
  }
}

/**
 * Compute the rank position of a model in ParentBench leaderboard.
 * Returns 1-indexed rank (1 = best).
 */
export async function computeParentBenchRank(slug: string): Promise<number | null> {
  const scores = await getParentBenchScores();
  const index = scores.findIndex((s) => s.modelSlug === slug);
  return index === -1 ? null : index + 1;
}

/**
 * Get total number of models evaluated in ParentBench
 */
export async function getParentBenchModelCount(): Promise<number> {
  const scores = await getParentBenchScores();
  return scores.length;
}

/**
 * Get ParentBench last updated date.
 * Returns the most recent date from methodology (static) for consistency.
 */
export async function getParentBenchLastUpdated(): Promise<string> {
  const methodologyData = await loadMethodologyData();
  return methodologyData.lastUpdated;
}
