"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Evaluation {
  id: string;
  status: string;
  triggeredBy: string | null;
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
  score: {
    overallScore: number;
    overallGrade: string;
  } | null;
}

interface EvaluationsListProps {
  initialEvaluations: Evaluation[];
  initialHasRunning: boolean;
}

export function EvaluationsList({ initialEvaluations, initialHasRunning }: EvaluationsListProps) {
  const [evaluations, setEvaluations] = useState(initialEvaluations);
  const [hasRunning, setHasRunning] = useState(initialHasRunning);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchEvaluations = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch("/api/admin/evaluations");
      if (response.ok) {
        const data = await response.json();
        setEvaluations(data.evaluations);
        setHasRunning(data.hasRunning);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error("Failed to fetch evaluations:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Auto-refresh when there are running evaluations
  useEffect(() => {
    if (!hasRunning) return;

    const interval = setInterval(fetchEvaluations, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [hasRunning, fetchEvaluations]);

  return (
    <div className="space-y-4">
      {/* Auto-refresh indicator */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          {hasRunning ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              <span>Auto-refreshing every 3s</span>
            </>
          ) : (
            <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
          )}
        </div>
        <button
          onClick={fetchEvaluations}
          disabled={isRefreshing}
          className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 disabled:opacity-50"
        >
          <svg
            className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
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
            {evaluations.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                >
                  No evaluations yet. Run your first evaluation to get started.
                </td>
              </tr>
            ) : (
              evaluations.map((evaluation) => (
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
  );
}

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
