import { db } from "@/db";
import { evaluations, models, providers } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { EvaluationsList } from "./evaluations-list";

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

  // Check if any are running
  const hasRunning = allEvaluations.some(e => e.status === "running" || e.status === "pending");

  // Serialize dates for client component
  const serialized = allEvaluations.map(e => ({
    ...e,
    startedAt: e.startedAt?.toISOString() ?? null,
    completedAt: e.completedAt?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
  }));

  return { evaluations: serialized, hasRunning };
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function EvaluationsPage() {
  const { evaluations: evaluationsData, hasRunning } = await getEvaluations();

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

      {/* Evaluations list with auto-refresh */}
      <EvaluationsList
        initialEvaluations={evaluationsData}
        initialHasRunning={hasRunning}
      />
    </div>
  );
}
