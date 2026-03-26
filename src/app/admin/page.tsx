import { db } from "@/db";
import { models, evaluations, certifications, testCases, submissions, providers, scores } from "@/db/schema";
import { eq, count, desc } from "drizzle-orm";
import Link from "next/link";

// ============================================================================
// STATS LOADING
// ============================================================================

async function getStats() {
  const [
    modelCount,
    activeTestCaseCount,
    recentEvaluations,
    pendingCertifications,
    pendingSubmissions,
  ] = await Promise.all([
    // Total models
    db.select({ count: count() }).from(models).where(eq(models.isActive, true)),
    // Active test cases
    db.select({ count: count() }).from(testCases).where(eq(testCases.isActive, true)),
    // Recent evaluations (top 10)
    db
      .select({
        id: evaluations.id,
        status: evaluations.status,
        triggeredBy: evaluations.triggeredBy,
        startedAt: evaluations.startedAt,
        completedAt: evaluations.completedAt,
        totalTestCases: evaluations.totalTestCases,
        completedTestCases: evaluations.completedTestCases,
        failedTestCases: evaluations.failedTestCases,
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
        score: {
          overallScore: scores.overallScore,
          overallGrade: scores.overallGrade,
        },
      })
      .from(evaluations)
      .innerJoin(models, eq(evaluations.modelId, models.id))
      .innerJoin(providers, eq(models.providerId, providers.id))
      .leftJoin(scores, eq(scores.evaluationId, evaluations.id))
      .orderBy(desc(evaluations.createdAt))
      .limit(10),
    // Pending certifications
    db
      .select({ count: count() })
      .from(certifications)
      .where(eq(certifications.status, "in_review")),
    // Pending submissions
    db
      .select({ count: count() })
      .from(submissions)
      .where(eq(submissions.status, "pending")),
  ]);

  return {
    models: modelCount[0]?.count ?? 0,
    testCases: activeTestCaseCount[0]?.count ?? 0,
    recentEvaluations,
    pendingCertifications: pendingCertifications[0]?.count ?? 0,
    pendingSubmissions: pendingSubmissions[0]?.count ?? 0,
  };
}

// ============================================================================
// STAT CARD COMPONENT
// ============================================================================

function StatCard({
  title,
  value,
  description,
  href,
  color = "indigo",
}: {
  title: string;
  value: number;
  description?: string;
  href?: string;
  color?: "indigo" | "green" | "yellow" | "red";
}) {
  const colorClasses = {
    indigo: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400",
    green: "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400",
    yellow: "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400",
    red: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400",
  };

  const content = (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {title}
          </p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {value.toLocaleString()}
          </p>
          {description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {description}
            </p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colorClasses[color]}`}>
          <span className="text-lg font-semibold">{value > 99 ? "99+" : value}</span>
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block hover:ring-2 hover:ring-indigo-500 hover:ring-offset-2 rounded-xl transition-shadow">
        {content}
      </a>
    );
  }

  return content;
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default async function AdminDashboard() {
  const stats = await getStats();

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Overview of ParentBench evaluation system
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Active Models"
          value={stats.models}
          description="AI models being evaluated"
          href="/admin/models"
          color="indigo"
        />
        <StatCard
          title="Test Cases"
          value={stats.testCases}
          description="Active safety test cases"
          href="/admin/test-cases"
          color="green"
        />
        <StatCard
          title="Pending Certifications"
          value={stats.pendingCertifications}
          description="Awaiting review"
          href="/admin/certifications"
          color="yellow"
        />
        <StatCard
          title="Pending Submissions"
          value={stats.pendingSubmissions}
          description="Community test cases"
          href="/admin/submissions"
          color="red"
        />
      </div>

      {/* Recent evaluations */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Recent Evaluations
          </h2>
          <Link
            href="/admin/evaluations"
            className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
          >
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
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
                  Score
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
              {stats.recentEvaluations.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    No evaluations yet. Run your first evaluation to get started.
                  </td>
                </tr>
              ) : (
                stats.recentEvaluations.map((evaluation) => (
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
                            className={`h-2 rounded-full transition-all duration-300 ${
                              evaluation.status === "running"
                                ? "bg-indigo-600"
                                : evaluation.status === "completed"
                                ? "bg-green-500"
                                : evaluation.status === "failed"
                                ? "bg-red-500"
                                : "bg-gray-400"
                            }`}
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
                        <span className="text-sm text-gray-600 dark:text-gray-400 tabular-nums">
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
                      {evaluation.score ? (
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-sm font-semibold ${getGradeColor(
                              evaluation.score.overallGrade
                            )}`}
                          >
                            {evaluation.score.overallGrade}
                          </span>
                          <span className="text-gray-600 dark:text-gray-400 text-sm">
                            {evaluation.score.overallScore.toFixed(1)}
                          </span>
                        </div>
                      ) : evaluation.status === "completed" ? (
                        <span className="text-gray-400 dark:text-gray-500 text-sm">
                          No score
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 text-sm">
                          —
                        </span>
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

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <QuickAction
          title="Run Evaluation"
          description="Start a new model evaluation"
          href="/admin/evaluations/new"
          icon={
            <svg
              className="w-6 h-6"
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
          }
        />
        <QuickAction
          title="Add Test Case"
          description="Create a new safety test case"
          href="/admin/test-cases/new"
          icon={
            <svg
              className="w-6 h-6"
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
          }
        />
        <QuickAction
          title="Review Certifications"
          description="Process pending applications"
          href="/admin/certifications?status=in_review"
          icon={
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
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
    running: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse",
    completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    partial: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
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

function QuickAction({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="block bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md transition-all"
    >
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
        </div>
      </div>
    </a>
  );
}
