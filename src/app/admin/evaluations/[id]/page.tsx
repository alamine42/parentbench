"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface EvaluationDetail {
  id: string;
  status: string;
  triggeredBy: string | null;
  inngestRunId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  totalTestCases: number;
  completedTestCases: number;
  failedTestCases: number;
  errorMessage: string | null;
  createdAt: string;
  model: {
    id: string;
    name: string;
    slug: string;
  };
  provider: {
    id: string;
    name: string;
  };
}

interface Score {
  overallScore: number;
  overallGrade: string;
  categoryScores: Record<string, { score: number; grade: string }> | null;
}

interface TestResult {
  id: string;
  passed: boolean;
  score: number | null;
  response: string | null;
  latencyMs: number | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  testCase: {
    id: string;
    prompt: string;
    expectedBehavior: string;
    severity: string;
    description: string;
  };
  category: {
    id: string;
    name: string;
  };
}

export default function EvaluationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [evaluation, setEvaluation] = useState<EvaluationDetail | null>(null);
  const [score, setScore] = useState<Score | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "passed" | "failed">("all");
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/evaluations/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to delete evaluation");
        setDeleting(false);
        return;
      }
      router.push("/admin/evaluations");
    } catch (err) {
      alert("Failed to delete evaluation");
      setDeleting(false);
    }
  };

  useEffect(() => {
    async function fetchDetails() {
      try {
        const response = await fetch(`/api/admin/evaluations/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("Evaluation not found");
          } else {
            setError("Failed to load evaluation");
          }
          return;
        }
        const data = await response.json();
        setEvaluation(data.evaluation);
        setScore(data.score);
        setResults(data.results);
      } catch (err) {
        setError("Failed to load evaluation");
      } finally {
        setLoading(false);
      }
    }
    fetchDetails();
  }, [id]);

  const filteredResults = results.filter((r) => {
    if (filter === "passed") return r.passed;
    if (filter === "failed") return !r.passed;
    return true;
  });

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !evaluation) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">{error || "Evaluation not found"}</p>
        <Link
          href="/admin/evaluations"
          className="mt-4 inline-block text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Back to Evaluations
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/evaluations"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {evaluation.model.name}
            </h1>
            <StatusBadge status={evaluation.status} />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1 ml-8">
            {evaluation.provider.name} &middot; {evaluation.model.slug}
          </p>
        </div>
        {/* Delete button - only show for non-running evaluations */}
        {evaluation.status !== "running" && evaluation.status !== "pending" && (
          <div className="relative">
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                <span className="text-sm text-red-700 dark:text-red-300">Delete this evaluation?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Yes, delete"}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1 text-gray-600 dark:text-gray-400 text-sm hover:text-gray-800"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Score card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Score</p>
          {score ? (
            <div className="flex items-center gap-3">
              <span className={`text-3xl font-bold ${getGradeTextColor(score.overallGrade)}`}>
                {score.overallGrade}
              </span>
              <span className="text-2xl text-gray-700 dark:text-gray-300">
                {score.overallScore.toFixed(1)}
              </span>
            </div>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">—</span>
          )}
        </div>

        {/* Test cases card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Test Cases</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {evaluation.completedTestCases}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              / {evaluation.totalTestCases}
            </span>
          </div>
        </div>

        {/* Pass rate card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Pass Rate</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-green-600 dark:text-green-400">
              {results.length > 0 ? ((passedCount / results.length) * 100).toFixed(0) : 0}%
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              ({passedCount} passed, {failedCount} failed)
            </span>
          </div>
        </div>

        {/* Duration card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Duration</p>
          {evaluation.startedAt && evaluation.completedAt ? (
            <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatDuration(
                new Date(evaluation.completedAt).getTime() -
                  new Date(evaluation.startedAt).getTime()
              )}
            </span>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">—</span>
          )}
        </div>
      </div>

      {/* Inngest Run Info */}
      {evaluation.inngestRunId && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Inngest Run</p>
              <code className="text-sm font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-900/50 px-2 py-1 rounded">
                {evaluation.inngestRunId}
              </code>
            </div>
            <a
              href={`https://app.inngest.com/env/production/runs/${evaluation.inngestRunId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View in Inngest
            </a>
          </div>
        </div>
      )}

      {/* Category scores */}
      {score?.categoryScores && Object.keys(score.categoryScores).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Category Scores</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(score.categoryScores).map(([category, data]) => (
              <div key={category} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                  {category.replace(/_/g, " ")}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getGradeColor(data.grade)}`}>
                    {data.grade}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {data.score.toFixed(0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results filter */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">
          Test Results ({filteredResults.length})
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1 rounded-lg text-sm ${
              filter === "all"
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            All ({results.length})
          </button>
          <button
            onClick={() => setFilter("passed")}
            className={`px-3 py-1 rounded-lg text-sm ${
              filter === "passed"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            Passed ({passedCount})
          </button>
          <button
            onClick={() => setFilter("failed")}
            className={`px-3 py-1 rounded-lg text-sm ${
              filter === "failed"
                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            Failed ({failedCount})
          </button>
        </div>
      </div>

      {/* Results list */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {filteredResults.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
            No results to display
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredResults.map((result) => (
              <div key={result.id} className="p-4">
                <div
                  className="flex items-start gap-4 cursor-pointer"
                  onClick={() => setExpandedResult(expandedResult === result.id ? null : result.id)}
                >
                  {/* Pass/Fail indicator */}
                  <div className="flex-shrink-0 mt-1">
                    {result.passed ? (
                      <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        {result.category.name}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${getSeverityColor(result.testCase.severity)}`}>
                        {result.testCase.severity}
                      </span>
                      {result.score !== null && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Score: {result.score.toFixed(0)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                      {result.testCase.prompt}
                    </p>
                  </div>

                  {/* Expand icon */}
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedResult === result.id ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Expanded content */}
                {expandedResult === result.id && (
                  <div className="mt-4 ml-10 space-y-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Expected Behavior</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                        {result.testCase.expectedBehavior.replace(/_/g, " ")}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {result.testCase.description}
                      </p>
                    </div>

                    {result.response && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Model Response</p>
                        <pre className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg whitespace-pre-wrap max-h-48 overflow-y-auto">
                          {result.response}
                        </pre>
                      </div>
                    )}

                    {typeof result.metadata?.judgeReasoning === "string" && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Judge Reasoning</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg">
                          {result.metadata.judgeReasoning}
                        </p>
                      </div>
                    )}

                    {result.errorMessage && (
                      <div>
                        <p className="text-xs font-medium text-red-500 dark:text-red-400 mb-1">Error</p>
                        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                          {result.errorMessage}
                        </p>
                      </div>
                    )}

                    {result.latencyMs && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Response time: {result.latencyMs}ms
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
    running: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    partial: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${colors[status] || colors.pending}`}>
      {status}
    </span>
  );
}

function getGradeColor(grade: string): string {
  if (grade.startsWith("A")) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  if (grade.startsWith("B")) return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
  if (grade.startsWith("C")) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  if (grade.startsWith("D")) return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
}

function getGradeTextColor(grade: string): string {
  if (grade.startsWith("A")) return "text-green-600 dark:text-green-400";
  if (grade.startsWith("B")) return "text-blue-600 dark:text-blue-400";
  if (grade.startsWith("C")) return "text-yellow-600 dark:text-yellow-400";
  if (grade.startsWith("D")) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    case "high":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
    case "medium":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400";
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}
