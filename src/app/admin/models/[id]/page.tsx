"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Provider {
  id: string;
  name: string;
  slug: string;
}

interface Model {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  evalTier: string;
  provider: Provider;
}

interface Score {
  id: string;
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
  }> | null;
  computedAt: string;
  evaluationId: string | null;
}

interface Evaluation {
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
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
  createdAt: string;
}

interface Stats {
  totalEvaluations: number;
  completedEvaluations: number;
  failedEvaluations: number;
  totalCostUsd: number;
  latestScore: Score | null;
  scoreRange: { min: number; max: number; avg: number } | null;
}

interface ScoreTrendPoint {
  date: string;
  score: number;
  grade: string;
}

export default function ModelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [model, setModel] = useState<Model | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [scoreTrend, setScoreTrend] = useState<ScoreTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const response = await fetch(`/api/admin/models/${id}/history`);
      if (!response.ok) {
        if (response.status === 404) {
          setError("Model not found");
        } else if (response.status === 401) {
          router.push("/admin/login");
          return;
        } else {
          setError("Failed to load model data");
        }
        return;
      }
      const data = await response.json();
      setModel(data.model);
      setScores(data.scores);
      setEvaluations(data.evaluations);
      setStats(data.stats);
      setScoreTrend(data.scoreTrend);
    } catch (err) {
      setError("Failed to load model data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleDelete = async (evalId: string) => {
    setDeletingId(evalId);
    try {
      const response = await fetch(`/api/admin/evaluations/${evalId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to delete evaluation");
        return;
      }
      // Refresh data after successful deletion
      await fetchData();
      setDeleteConfirm(null);
    } catch (err) {
      alert("Failed to delete evaluation");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !model) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">{error || "Model not found"}</p>
        <Link
          href="/admin/models"
          className="mt-4 inline-block text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Back to Models
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
              href="/admin/models"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {model.name}
            </h1>
            {model.isActive ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                Active
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400">
                Inactive
              </span>
            )}
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1 ml-8">
            {model.provider.name} &middot; {model.slug}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/models/${id}/edit`}
            className="px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Edit Model
          </Link>
          <Link
            href={`/admin/evaluations/new?modelId=${id}`}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Run Evaluation
          </Link>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Current Score */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Current Score</p>
          {stats?.latestScore ? (
            <div className="flex items-center gap-2">
              <span className={`text-3xl font-bold ${getGradeTextColor(stats.latestScore.overallGrade)}`}>
                {stats.latestScore.overallGrade}
              </span>
              <span className="text-xl text-gray-700 dark:text-gray-300">
                {stats.latestScore.overallScore.toFixed(1)}
              </span>
            </div>
          ) : (
            <span className="text-2xl text-gray-400 dark:text-gray-500">—</span>
          )}
        </div>

        {/* Score Range */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Score Range</p>
          {stats?.scoreRange ? (
            <div className="text-sm">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.scoreRange.avg.toFixed(1)}
                </span>
                <span className="text-gray-500 dark:text-gray-400">avg</span>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                {stats.scoreRange.min.toFixed(1)} - {stats.scoreRange.max.toFixed(1)}
              </p>
            </div>
          ) : (
            <span className="text-2xl text-gray-400 dark:text-gray-500">—</span>
          )}
        </div>

        {/* Total Evaluations */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Evaluations</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {stats?.totalEvaluations ?? 0}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              ({stats?.completedEvaluations ?? 0} completed)
            </span>
          </div>
        </div>

        {/* Failed Evaluations */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Failed Runs</p>
          <span className={`text-3xl font-bold ${(stats?.failedEvaluations ?? 0) > 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}>
            {stats?.failedEvaluations ?? 0}
          </span>
        </div>

        {/* Total Cost */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Cost</p>
          <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            ${(stats?.totalCostUsd ?? 0).toFixed(3)}
          </span>
        </div>
      </div>

      {/* Score Trend Chart */}
      {scoreTrend.length > 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Score History</h3>
          <div className="relative h-48">
            <ScoreChart data={scoreTrend} />
          </div>
        </div>
      )}

      {/* Category Scores (Latest) */}
      {stats?.latestScore?.categoryScores && stats.latestScore.categoryScores.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Latest Category Scores</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.latestScore.categoryScores.map((cat) => (
              <div key={cat.category} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                  {cat.category.replace(/_/g, " ")}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getGradeColor(cat.grade)}`}>
                    {cat.grade}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {cat.score.toFixed(0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evaluation History */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            Evaluation History ({evaluations.length})
          </h3>
        </div>
        {evaluations.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
            No evaluations yet. Run your first evaluation to get started.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tests
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Triggered By
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {evaluations.map((evaluation) => {
                const matchingScore = scores.find(s => s.evaluationId === evaluation.id);
                return (
                  <tr key={evaluation.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      {new Date(evaluation.createdAt).toLocaleDateString()}{" "}
                      <span className="text-gray-500 dark:text-gray-400">
                        {new Date(evaluation.createdAt).toLocaleTimeString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={evaluation.status} />
                    </td>
                    <td className="px-6 py-4">
                      {matchingScore ? (
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-sm font-semibold ${getGradeColor(matchingScore.overallGrade)}`}>
                            {matchingScore.overallGrade}
                          </span>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {matchingScore.overallScore.toFixed(1)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {evaluation.completedTestCases}/{evaluation.totalTestCases}
                      {evaluation.failedTestCases > 0 && (
                        <span className="text-red-500 ml-1">({evaluation.failedTestCases} failed)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      ${evaluation.totalCostUsd.toFixed(4)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 capitalize">
                      {evaluation.triggeredBy || "Unknown"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/evaluations/${evaluation.id}`}
                          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-sm font-medium"
                        >
                          View
                        </Link>
                        {evaluation.status !== "running" && evaluation.status !== "pending" && (
                          <>
                            {deleteConfirm === evaluation.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(evaluation.id)}
                                  disabled={deletingId === evaluation.id}
                                  className="text-red-600 dark:text-red-400 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                                >
                                  {deletingId === evaluation.id ? "..." : "Confirm"}
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="text-gray-500 dark:text-gray-400 text-sm"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(evaluation.id)}
                                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium"
                              >
                                Delete
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// Simple SVG-based score chart
function ScoreChart({ data }: { data: ScoreTrendPoint[] }) {
  if (data.length < 2) return null;

  const padding = 40;
  const width = 800;
  const height = 192;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const scores = data.map(d => d.score);
  const minScore = Math.floor(Math.min(...scores) / 10) * 10;
  const maxScore = Math.ceil(Math.max(...scores) / 10) * 10;
  const scoreRange = maxScore - minScore || 10;

  const points = data.map((d, i) => ({
    x: padding + (i / (data.length - 1)) * chartWidth,
    y: padding + chartHeight - ((d.score - minScore) / scoreRange) * chartHeight,
    ...d,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map(pct => {
        const y = padding + chartHeight - (pct / 100) * chartHeight;
        const label = minScore + (pct / 100) * scoreRange;
        return (
          <g key={pct}>
            <line
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="currentColor"
              className="text-gray-200 dark:text-gray-700"
              strokeDasharray="4"
            />
            <text
              x={padding - 8}
              y={y + 4}
              textAnchor="end"
              className="fill-gray-400 dark:fill-gray-500 text-xs"
            >
              {label.toFixed(0)}
            </text>
          </g>
        );
      })}

      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke="currentColor"
        className="text-indigo-500"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x}
            cy={p.y}
            r="4"
            fill="currentColor"
            className="text-indigo-500"
          />
          {/* Show labels for first, last, and every 5th point */}
          {(i === 0 || i === points.length - 1 || i % 5 === 0) && (
            <text
              x={p.x}
              y={height - 8}
              textAnchor="middle"
              className="fill-gray-400 dark:fill-gray-500 text-xs"
            >
              {p.date.slice(5)} {/* MM-DD */}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

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
