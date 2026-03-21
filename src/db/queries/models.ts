import { db } from "@/db";
import { models, providers, scores } from "@/db/schema";
import { eq, desc, gte, and } from "drizzle-orm";

export type ModelWithProvider = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  releaseDate: Date | null;
  parameterCount: string | null;
  isActive: boolean;
  provider: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
  };
};

export type ModelWithScore = ModelWithProvider & {
  latestScore: {
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
  } | null;
};

/**
 * Get all active models with their providers
 */
export async function getAllModels(): Promise<ModelWithProvider[]> {
  const result = await db
    .select({
      id: models.id,
      slug: models.slug,
      name: models.name,
      description: models.description,
      releaseDate: models.releaseDate,
      parameterCount: models.parameterCount,
      isActive: models.isActive,
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
}

/**
 * Get a single model by slug with provider
 */
export async function getModelBySlug(slug: string): Promise<ModelWithProvider | null> {
  const result = await db
    .select({
      id: models.id,
      slug: models.slug,
      name: models.name,
      description: models.description,
      releaseDate: models.releaseDate,
      parameterCount: models.parameterCount,
      isActive: models.isActive,
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

  return result[0] || null;
}

/**
 * Get model with latest score
 */
export async function getModelWithScore(slug: string): Promise<ModelWithScore | null> {
  const model = await getModelBySlug(slug);
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
          overallScore: latestScore.overallScore,
          overallGrade: latestScore.overallGrade,
          trend: latestScore.trend,
          dataQuality: latestScore.dataQuality,
          categoryScores: latestScore.categoryScores as ModelWithScore["latestScore"] extends null ? never : NonNullable<ModelWithScore["latestScore"]>["categoryScores"],
          computedAt: latestScore.computedAt,
        }
      : null,
  };
}

/**
 * Get all models with their latest scores, sorted by score
 */
export async function getAllModelsWithScores(): Promise<ModelWithScore[]> {
  const allModels = await getAllModels();

  const modelsWithScores: ModelWithScore[] = [];

  for (const model of allModels) {
    const latestScoreResult = await db
      .select()
      .from(scores)
      .where(eq(scores.modelId, model.id))
      .orderBy(desc(scores.computedAt))
      .limit(1);

    const latestScore = latestScoreResult[0];

    modelsWithScores.push({
      ...model,
      latestScore: latestScore
        ? {
            overallScore: latestScore.overallScore,
            overallGrade: latestScore.overallGrade,
            trend: latestScore.trend,
            dataQuality: latestScore.dataQuality,
            categoryScores: latestScore.categoryScores as ModelWithScore["latestScore"] extends null ? never : NonNullable<ModelWithScore["latestScore"]>["categoryScores"],
            computedAt: latestScore.computedAt,
          }
        : null,
    });
  }

  // Sort by overall score descending
  return modelsWithScores.sort((a, b) => {
    const scoreA = a.latestScore?.overallScore ?? 0;
    const scoreB = b.latestScore?.overallScore ?? 0;
    return scoreB - scoreA;
  });
}

/**
 * Get score history for a model (basic)
 */
export async function getModelScoreHistory(
  modelId: string,
  limit = 30
): Promise<Array<{
  overallScore: number;
  overallGrade: string;
  trend: string;
  computedAt: Date;
}>> {
  const result = await db
    .select({
      overallScore: scores.overallScore,
      overallGrade: scores.overallGrade,
      trend: scores.trend,
      computedAt: scores.computedAt,
    })
    .from(scores)
    .where(eq(scores.modelId, modelId))
    .orderBy(desc(scores.computedAt))
    .limit(limit);

  return result;
}

export type CategoryScore = {
  category: string;
  score: number;
  grade: string;
  passRate: number;
  testCount: number;
};

export type ScoreHistoryEntry = {
  overallScore: number;
  overallGrade: string;
  trend: string;
  dataQuality: string;
  categoryScores: CategoryScore[];
  computedAt: Date;
};

export type TimeRange = "1M" | "3M" | "6M" | "1Y" | "ALL";

/**
 * Get score history with category breakdown and time range filtering
 */
export async function getModelScoreHistoryWithCategories(
  modelId: string,
  options: {
    timeRange?: TimeRange;
    limit?: number;
  } = {}
): Promise<ScoreHistoryEntry[]> {
  const { timeRange = "ALL", limit = 100 } = options;

  // Calculate date range
  let fromDate: Date | null = null;
  const now = new Date();

  switch (timeRange) {
    case "1M":
      fromDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
    case "3M":
      fromDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case "6M":
      fromDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      break;
    case "1Y":
      fromDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    case "ALL":
    default:
      fromDate = null;
  }

  // Build query conditions
  const conditions = fromDate
    ? and(eq(scores.modelId, modelId), gte(scores.computedAt, fromDate))
    : eq(scores.modelId, modelId);

  const result = await db
    .select({
      overallScore: scores.overallScore,
      overallGrade: scores.overallGrade,
      trend: scores.trend,
      dataQuality: scores.dataQuality,
      categoryScores: scores.categoryScores,
      computedAt: scores.computedAt,
    })
    .from(scores)
    .where(conditions)
    .orderBy(desc(scores.computedAt))
    .limit(limit);

  return result.map((row) => ({
    overallScore: row.overallScore,
    overallGrade: row.overallGrade,
    trend: row.trend,
    dataQuality: row.dataQuality,
    categoryScores: (row.categoryScores || []) as CategoryScore[],
    computedAt: row.computedAt,
  }));
}

export type ScoreTrend = {
  direction: "up" | "down" | "stable";
  changePercent: number;
  changeAbsolute: number;
  periodStart: Date | null;
  periodEnd: Date | null;
};

/**
 * Calculate trend for a model's score over the given time range
 */
export async function calculateScoreTrend(
  modelId: string,
  timeRange: TimeRange = "ALL"
): Promise<ScoreTrend> {
  const history = await getModelScoreHistoryWithCategories(modelId, { timeRange });

  if (history.length < 2) {
    return {
      direction: "stable",
      changePercent: 0,
      changeAbsolute: 0,
      periodStart: history[0]?.computedAt ?? null,
      periodEnd: history[0]?.computedAt ?? null,
    };
  }

  // Most recent score is first in the array (descending order)
  const latest = history[0];
  const oldest = history[history.length - 1];

  const changeAbsolute = latest.overallScore - oldest.overallScore;
  const changePercent = oldest.overallScore > 0
    ? ((changeAbsolute / oldest.overallScore) * 100)
    : 0;

  let direction: "up" | "down" | "stable";
  if (changeAbsolute > 0.5) {
    direction = "up";
  } else if (changeAbsolute < -0.5) {
    direction = "down";
  } else {
    direction = "stable";
  }

  return {
    direction,
    changePercent: Math.round(changePercent * 100) / 100,
    changeAbsolute: Math.round(changeAbsolute * 100) / 100,
    periodStart: oldest.computedAt,
    periodEnd: latest.computedAt,
  };
}

/**
 * Get multiple models' latest scores for comparison
 */
export async function getModelsForComparison(
  modelSlugs: string[]
): Promise<ModelWithScore[]> {
  const results: ModelWithScore[] = [];

  for (const slug of modelSlugs) {
    const model = await getModelWithScore(slug);
    if (model) {
      results.push(model);
    }
  }

  return results;
}
