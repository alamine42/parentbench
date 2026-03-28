import { db } from "@/db";
import { models, providers, scores } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { ModelsTable } from "./models-table";

// ============================================================================
// DATA LOADING
// ============================================================================

async function getModels() {
  const allModels = await db
    .select({
      id: models.id,
      name: models.name,
      slug: models.slug,
      description: models.description,
      isActive: models.isActive,
      evalTier: models.evalTier,
      createdAt: models.createdAt,
      provider: {
        id: providers.id,
        name: providers.name,
        slug: providers.slug,
      },
    })
    .from(models)
    .innerJoin(providers, eq(models.providerId, providers.id))
    .orderBy(models.name);

  // Get latest scores for each model
  const modelsWithScores = await Promise.all(
    allModels.map(async (model) => {
      const [latestScore] = await db
        .select({
          overallScore: scores.overallScore,
          overallGrade: scores.overallGrade,
          computedAt: scores.computedAt,
        })
        .from(scores)
        .where(eq(scores.modelId, model.id))
        .orderBy(desc(scores.computedAt))
        .limit(1);

      return {
        ...model,
        latestScore: latestScore || null,
      };
    })
  );

  // Get unique provider names
  const uniqueProviders = [...new Set(allModels.map((m) => m.provider.name))].sort();

  return { models: modelsWithScores, providers: uniqueProviders };
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function ModelsPage() {
  const { models: modelsData, providers: providersList } = await getModels();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Models
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage AI models being evaluated
          </p>
        </div>
        <Link
          href="/admin/models/new"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Model
        </Link>
      </div>

      {/* Models table with filters and sorting */}
      <ModelsTable models={modelsData} providers={providersList} />
    </div>
  );
}
