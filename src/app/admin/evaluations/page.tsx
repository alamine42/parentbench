import { db } from "@/db";
import { evaluations, models, providers } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";

// ============================================================================
// DATA LOADING
// ============================================================================

async function getEvaluations() {
  const allEvaluations = await db
    .select({
      id: evaluations.id,
      status: evaluations.status,
      triggeredBy: evaluations.triggeredBy,
      startedAt: evaluations.startedAt,
      completedAt: evaluations.completedAt,
      totalTestCases: evaluations.totalTestCases,
      completedTestCases: evaluations.completedTestCases,
      failedTestCases: evaluations.failedTestCases,
      errorMessage: evaluations.errorMessage,
      createdAt: evaluations.createdAt,
      model: {
        id: models.id,
        name: models.name,
        slug: models.slug,
      },
      provider: {
        id: providers.id,
        name: providers.name,
      },
    })
    .from(evaluations)
    .innerJoin(models, eq(evaluations.modelId, models.id))
    .innerJoin(providers, eq(models.providerId, providers.id))
    .orderBy(desc(evaluations.createdAt))
    .limit(100);

  return allEvaluations;
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function EvaluationsPage() {
  const evaluationsData = await getEvaluations();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Evaluations
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Monitor model evaluation runs
          </p>
        </div>
        <Link
          href="/admin/evaluations/new"
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
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Run Evaluation
        </Link>
      </div>

      {/* Evaluations table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Model
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Progress
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Triggered By
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Started
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {evaluationsData.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                >
                  No evaluations yet. Run your first evaluation to get started.
                </td>
              </tr>
            ) : (
              evaluationsData.map((evaluation) => (
                <tr
                  key={evaluation.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-900/50"
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {evaluation.model.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {evaluation.provider.name}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={evaluation.status} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 w-24">
                        <div
                          className="bg-indigo-600 h-2 rounded-full"
                          style={{
                            width: `${
                              evaluation.totalTestCases > 0
                                ? (evaluation.completedTestCases /
                                    evaluation.totalTestCases) *
                                  100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {evaluation.completedTestCases}/{evaluation.totalTestCases}
                      </span>
                    </div>
                    {evaluation.failedTestCases > 0 && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        {evaluation.failedTestCases} failed
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="capitalize text-gray-700 dark:text-gray-300">
                      {evaluation.triggeredBy || "Unknown"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {evaluation.startedAt
                      ? new Date(evaluation.startedAt).toLocaleString()
                      : "Not started"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/admin/evaluations/${evaluation.id}`}
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium"
                    >
                      View Details
                    </Link>
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
// SUB COMPONENTS
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
    running:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse",
    completed:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    partial:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  };

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
        colors[status] || colors.pending
      }`}
    >
      {status}
    </span>
  );
}
