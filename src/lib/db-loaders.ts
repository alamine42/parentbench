/**
 * Database-backed data loaders for ParentBench
 *
 * These loaders fetch data from the Postgres database.
 * Use these for dynamic data or when you need real-time updates.
 *
 * For static generation (ISR), continue using the JSON-based loaders
 * in parentbench.ts which don't require a database connection.
 */

import { cache } from "react";
import { db } from "@/db";
import { models, providers, scores, categories, testCases } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

export type DbModel = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  releaseDate: Date | null;
  parameterCount: string | null;
  provider: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
  };
};

export type DbScore = {
  id: string;
  modelId: string;
  overallScore: number;
  overallGrade: string;
  trend: string;
  dataQuality: string;
  categoryScores: Array<{
    category: string;
    score: number;
    grade: string;
    passRate: number;
    testCount: number;
  }>;
  computedAt: Date;
};

export type DbModelWithScore = DbModel & {
  latestScore: DbScore | null;
};

export type DbCategory = {
  id: string;
  name: string;
  label: string;
  description: string;
  question: string;
  icon: string | null;
  weight: number;
};

export type DbTestCase = {
  id: string;
  categoryId: string;
  prompt: string;
  expectedBehavior: string;
  severity: string;
  description: string;
  ageBrackets: string[];
  modality: string;
};

// ============================================================================
// Loaders
// ============================================================================

/**
 * Get all models with providers (cached)
 */
export const getDbModels = cache(async (): Promise<DbModel[]> => {
  const result = await db
    .select({
      id: models.id,
      slug: models.slug,
      name: models.name,
      description: models.description,
      releaseDate: models.releaseDate,
      parameterCount: models.parameterCount,
      provider: {
        id: providers.id,
        name: providers.name,
        slug: providers.slug,
        logoUrl: providers.logoUrl,
      },
    })
    .from(models)
    .innerJoin(providers, eq(models.providerId, providers.id))
    .where(eq(models.isActive, true))
    .orderBy(models.name);

  return result;
});

/**
 * Get all models with their latest scores, sorted by score (cached)
 * Uses a single query for all scores to avoid N+1 problem
 */
export const getDbModelsWithScores = cache(async (): Promise<DbModelWithScore[]> => {
  const allModels = await getDbModels();

  if (allModels.length === 0) {
    return [];
  }

  // Get all model IDs
  const modelIds = allModels.map(m => m.id);

  // Fetch all scores in a single query, ordered by computedAt desc
  const allScoresResult = await db
    .select()
    .from(scores)
    .orderBy(desc(scores.computedAt));

  // Build a map of modelId -> latest score (first occurrence since sorted desc)
  const latestScoresByModel = new Map<string, typeof allScoresResult[0]>();
  for (const score of allScoresResult) {
    if (modelIds.includes(score.modelId) && !latestScoresByModel.has(score.modelId)) {
      latestScoresByModel.set(score.modelId, score);
    }
  }

  // Combine models with their scores
  const modelsWithScores: DbModelWithScore[] = allModels.map(model => {
    const latestScore = latestScoresByModel.get(model.id);
    return {
      ...model,
      latestScore: latestScore
        ? {
            id: latestScore.id,
            modelId: latestScore.modelId,
            overallScore: latestScore.overallScore,
            overallGrade: latestScore.overallGrade,
            trend: latestScore.trend,
            dataQuality: latestScore.dataQuality,
            categoryScores: (latestScore.categoryScores || []) as DbScore["categoryScores"],
            computedAt: latestScore.computedAt,
          }
        : null,
    };
  });

  // Sort by overall score descending
  return modelsWithScores.sort((a, b) => {
    const scoreA = a.latestScore?.overallScore ?? 0;
    const scoreB = b.latestScore?.overallScore ?? 0;
    return scoreB - scoreA;
  });
});

/**
 * Get a single model by slug with its latest score (cached)
 */
export const getDbModelBySlug = cache(async (slug: string): Promise<DbModelWithScore | null> => {
  const result = await db
    .select({
      id: models.id,
      slug: models.slug,
      name: models.name,
      description: models.description,
      releaseDate: models.releaseDate,
      parameterCount: models.parameterCount,
      provider: {
        id: providers.id,
        name: providers.name,
        slug: providers.slug,
        logoUrl: providers.logoUrl,
      },
    })
    .from(models)
    .innerJoin(providers, eq(models.providerId, providers.id))
    .where(eq(models.slug, slug))
    .limit(1);

  const model = result[0];
  if (!model) return null;

  const latestScoreResult = await db
    .select()
    .from(scores)
    .where(eq(scores.modelId, model.id))
    .orderBy(desc(scores.computedAt))
    .limit(1);

  const latestScore = latestScoreResult[0];

  return {
    ...model,
    latestScore: latestScore
      ? {
          id: latestScore.id,
          modelId: latestScore.modelId,
          overallScore: latestScore.overallScore,
          overallGrade: latestScore.overallGrade,
          trend: latestScore.trend,
          dataQuality: latestScore.dataQuality,
          categoryScores: latestScore.categoryScores as DbScore["categoryScores"],
          computedAt: latestScore.computedAt,
        }
      : null,
  };
});

/**
 * Get score history for a model (cached)
 */
export const getDbScoreHistory = cache(
  async (modelId: string, limit = 30): Promise<DbScore[]> => {
    const result = await db
      .select()
      .from(scores)
      .where(eq(scores.modelId, modelId))
      .orderBy(desc(scores.computedAt))
      .limit(limit);

    return result.map((s) => ({
      id: s.id,
      modelId: s.modelId,
      overallScore: s.overallScore,
      overallGrade: s.overallGrade,
      trend: s.trend,
      dataQuality: s.dataQuality,
      categoryScores: s.categoryScores as DbScore["categoryScores"],
      computedAt: s.computedAt,
    }));
  }
);

/**
 * Get all categories (cached)
 */
export const getDbCategories = cache(async (): Promise<DbCategory[]> => {
  const result = await db.select().from(categories).orderBy(categories.name);

  return result.map((c) => ({
    id: c.id,
    name: c.name,
    label: c.label,
    description: c.description,
    question: c.question,
    icon: c.icon,
    weight: c.weight,
  }));
});

/**
 * Get all active test cases (cached)
 */
export const getDbTestCases = cache(async (): Promise<DbTestCase[]> => {
  const result = await db
    .select()
    .from(testCases)
    .where(eq(testCases.isActive, true))
    .orderBy(testCases.categoryId);

  return result.map((t) => ({
    id: t.id,
    categoryId: t.categoryId,
    prompt: t.prompt,
    expectedBehavior: t.expectedBehavior,
    severity: t.severity,
    description: t.description,
    ageBrackets: t.ageBrackets as string[],
    modality: t.modality,
  }));
});

/**
 * Get model count
 */
export const getDbModelCount = cache(async (): Promise<number> => {
  const allModels = await getDbModels();
  return allModels.length;
});
