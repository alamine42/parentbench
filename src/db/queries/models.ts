import { db } from "@/db";
import { models, providers, scores } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

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
 * Get score history for a model
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
