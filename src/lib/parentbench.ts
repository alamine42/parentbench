import fs from "fs/promises";
import path from "path";
import { cache } from "react";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { models, scores, testCases, categories } from "@/db/schema";
import { sortByNetHelpfulness } from "@/lib/leaderboard/sort";
import type {
  ParentBenchScoresData,
  ParentBenchResult,
  ParentBenchMethodology,
  ParentBenchTestCasesData,
  ParentBenchTestCase,
  ParentBenchCategoryScore,
  ParentBenchCategory,
  ConfidenceLevel,
  EvaluationSurface,
} from "@/types/parentbench";
import type { LetterGrade, TrendDirection, DataQuality } from "@/types/model";

const DEFAULT_SURFACE: EvaluationSurface = "api-default";

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

// Shared projection. Drizzle infers the row type — no manual type alias,
// no `as` cast at the call site.
const SCORE_PROJECTION = {
  modelSlug: models.slug,
  surface: scores.surface,
  overallScore: scores.overallScore,
  overallGrade: scores.overallGrade,
  trend: scores.trend,
  dataQuality: scores.dataQuality,
  categoryScores: scores.categoryScores,
  evaluatedDate: scores.computedAt,
  confidence: scores.confidence,
  variance: scores.variance,
  isPartial: scores.isPartial,
  falseRefusalRate: scores.falseRefusalRate,
  netHelpfulness: scores.netHelpfulness,
  benignRefusalCount: scores.benignRefusalCount,
  benignTotalCount: scores.benignTotalCount,
  refusedBenignCaseIds: scores.refusedBenignCaseIds,
} as const;

type ScoreRow = {
  modelSlug: string;
  surface: string;
  overallScore: number;
  overallGrade: string;
  trend: string;
  dataQuality: string;
  categoryScores: unknown;
  evaluatedDate: Date | null;
  confidence: ConfidenceLevel;
  variance: number | null;
  isPartial: boolean;
  falseRefusalRate: number | null;
  netHelpfulness: number | null;
  benignRefusalCount: number | null;
  benignTotalCount: number | null;
  refusedBenignCaseIds: string[] | null;
};

function rowToResult(row: ScoreRow): ParentBenchResult {
  return {
    modelSlug: row.modelSlug,
    overallScore: row.overallScore,
    overallGrade: row.overallGrade as LetterGrade,
    trend: row.trend as TrendDirection,
    categoryScores:
      (row.categoryScores as ParentBenchCategoryScore[]) ?? [],
    evaluatedDate: row.evaluatedDate
      ? row.evaluatedDate.toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    dataQuality: row.dataQuality as DataQuality,
    methodologyVersion: "1.0.0",
    surface: row.surface as EvaluationSurface,
    confidence: row.confidence,
    variance: row.variance,
    isPartial: row.isPartial,
    falseRefusalRate: row.falseRefusalRate,
    netHelpfulness: row.netHelpfulness,
    benignRefusalCount: row.benignRefusalCount,
    benignTotalCount: row.benignTotalCount,
    refusedBenignCaseIds: row.refusedBenignCaseIds,
  };
}

/** Latest-per-key dedup — input must already be sorted by recency desc. */
function dedupLatest<K>(rows: ScoreRow[], keyOf: (r: ScoreRow) => K): ScoreRow[] {
  const seen = new Map<K, ScoreRow>();
  for (const row of rows) {
    const key = keyOf(row);
    if (!seen.has(key)) seen.set(key, row);
  }
  return Array.from(seen.values());
}

/**
 * One row per model within the requested surface (most-recent wins).
 * Default surface is `api-default` for back-compat. Wrapped in
 * `react.cache` so a single render only hits the DB once per surface.
 */
const loadScoresFromDB = cache(
  async (
    surface: EvaluationSurface = DEFAULT_SURFACE
  ): Promise<ParentBenchResult[]> => {
    try {
      const rows = await db
        .select(SCORE_PROJECTION)
        .from(scores)
        .innerJoin(models, eq(scores.modelId, models.id))
        .where(and(eq(models.isActive, true), eq(scores.surface, surface)))
        .orderBy(desc(scores.computedAt));
      return dedupLatest(rows, (r) => r.modelSlug).map(rowToResult);
    } catch (error) {
      console.error("[ParentBench] DB scores load failed:", error);
      throw error;
    }
  }
);

/**
 * One row per surface for a single model — drives the per-model
 * comparison panel.
 */
const loadScoresByModelFromDB = cache(
  async (modelSlug: string): Promise<ParentBenchResult[]> => {
    try {
      const rows = await db
        .select(SCORE_PROJECTION)
        .from(scores)
        .innerJoin(models, eq(scores.modelId, models.id))
        .where(eq(models.slug, modelSlug))
        .orderBy(desc(scores.computedAt));
      return dedupLatest(rows, (r) => r.surface).map(rowToResult);
    } catch (error) {
      console.error("[ParentBench] DB scores-by-model load failed:", error);
      throw error;
    }
  }
);

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
 * Get ParentBench scores for one surface (default `api-default` for
 * back-compat). Returns one row per model — the most recent score in
 * that surface. Sorted by NH desc with safety tiebreak; null NH sinks.
 *
 * The Web tab on the leaderboard calls this with `'web-product'`. The
 * comparison panel uses {@link getParentBenchScoresByModel} instead.
 */
export async function getParentBenchScores(
  surface: EvaluationSurface = DEFAULT_SURFACE
): Promise<ParentBenchResult[]> {
  let results: ParentBenchResult[];

  try {
    results = await loadScoresFromDB(surface);
    if (results.length === 0) {
      console.warn(
        `[ParentBench] No scores in DB for surface=${surface}, falling back to JSON`
      );
      results = await loadScoresFromJsonForSurface(surface);
    }
  } catch {
    console.warn("[ParentBench] DB unavailable, falling back to JSON");
    results = await loadScoresFromJsonForSurface(surface);
  }

  return sortByNetHelpfulness(results);
}

async function loadScoresFromJsonForSurface(
  surface: EvaluationSurface
): Promise<ParentBenchResult[]> {
  const data = await loadScoresFromJSON();
  return data.results.filter(
    (r) => (r.surface ?? DEFAULT_SURFACE) === surface
  );
}

/**
 * Get every surface's most-recent score for a single model. Used by
 * the per-model comparison panel. Returns at most one row per surface.
 */
export async function getParentBenchScoresByModel(
  slug: string
): Promise<ParentBenchResult[]> {
  try {
    return await loadScoresByModelFromDB(slug);
  } catch {
    console.warn(
      "[ParentBench] DB unavailable for scores-by-model, falling back to JSON"
    );
    const data = await loadScoresFromJSON();
    return data.results.filter((r) => r.modelSlug === slug);
  }
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
export async function getParentBenchModelCount(
  surface: EvaluationSurface = DEFAULT_SURFACE
): Promise<number> {
  const scores = await getParentBenchScores(surface);
  return scores.length;
}

/**
 * Get ParentBench last updated date — most recent evaluation date for
 * the requested surface (defaults to api-default for back-compat).
 */
export async function getParentBenchLastUpdated(
  surface: EvaluationSurface = DEFAULT_SURFACE
): Promise<string> {
  const scores = await getParentBenchScores(surface);
  if (scores.length === 0) {
    const methodologyData = await loadMethodologyData();
    return methodologyData.lastUpdated;
  }
  const mostRecent = scores.reduce((latest, score) => {
    return score.evaluatedDate > latest ? score.evaluatedDate : latest;
  }, scores[0].evaluatedDate);
  return mostRecent;
}
