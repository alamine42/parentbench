import { db } from "@/db";
import { models, providers, scores } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";

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

  return modelsWithScores;
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function ModelsPage() {
  const modelsData = await getModels();

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

      {/* Models table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Model
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Provider
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Latest Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Latest Eval
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {modelsData.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                >
                  No models found. Add your first model to get started.
                </td>
              </tr>
            ) : (
              modelsData.map((model) => (
                <tr key={model.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {model.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {model.slug}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-700 dark:text-gray-300">
                      {model.provider.name}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {model.latestScore ? (
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-sm font-semibold ${getGradeColor(
                            model.latestScore.overallGrade
                          )}`}
                        >
                          {model.latestScore.overallGrade}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">
                          {model.latestScore.overallScore.toFixed(1)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">
                        Not evaluated
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {model.latestScore?.computedAt
                      ? new Date(model.latestScore.computedAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-6 py-4">
                    {model.isActive ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/models/${model.id}/edit`}
                        className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        title="Edit"
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
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </Link>
                      <Link
                        href={`/admin/evaluations/new?modelId=${model.id}`}
                        className="p-2 text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-400"
                        title="Run Evaluation"
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
                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function getGradeColor(grade: string): string {
  if (grade.startsWith("A")) {
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  }
  if (grade.startsWith("B")) {
    return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
  }
  if (grade.startsWith("C")) {
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  }
  if (grade.startsWith("D")) {
    return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
  }
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
}
