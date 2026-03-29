"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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

  // Search and filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [triggerFilter, setTriggerFilter] = useState<string>("all");

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

    const interval = setInterval(fetchEvaluations, 3000);
    return () => clearInterval(interval);
  }, [hasRunning, fetchEvaluations]);

  // Get unique providers and triggers for filter dropdowns
  const providers = useMemo(() => {
    const unique = new Set(evaluations.map((e) => e.provider.name));
    return Array.from(unique).sort();
  }, [evaluations]);

  const triggers = useMemo(() => {
    const unique = new Set(evaluations.map((e) => e.triggeredBy || "Unknown"));
    return Array.from(unique).sort();
  }, [evaluations]);

  // Filter evaluations
  const filteredEvaluations = useMemo(() => {
    return evaluations.filter((e) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesModel = e.model.name.toLowerCase().includes(query) ||
          e.model.slug.toLowerCase().includes(query);
        const matchesProvider = e.provider.name.toLowerCase().includes(query);
        if (!matchesModel && !matchesProvider) return false;
      }

      // Status filter
      if (statusFilter !== "all" && e.status !== statusFilter) return false;

      // Provider filter
      if (providerFilter !== "all" && e.provider.name !== providerFilter) return false;

      // Trigger filter
      if (triggerFilter !== "all" && (e.triggeredBy || "Unknown") !== triggerFilter) return false;

      return true;
    });
  }, [evaluations, searchQuery, statusFilter, providerFilter, triggerFilter]);

  // Selectable evaluations (exclude running/pending)
  const selectableIds = useMemo(() => {
    return new Set(
      filteredEvaluations
        .filter((e) => e.status !== "running" && e.status !== "pending")
        .map((e) => e.id)
    );
  }, [filteredEvaluations]);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    setSelectedIds(new Set(selectableIds));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    setIsDeleting(true);
    const idsToDelete = Array.from(selectedIds);
    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const id of idsToDelete) {
      try {
        const response = await fetch(`/api/admin/evaluations/${id}`, {
          method: "DELETE",
        });
        if (response.ok) {
          results.push({ id, success: true });
        } else {
          const data = await response.json();
          results.push({ id, success: false, error: data.error });
        }
      } catch (error) {
        results.push({ id, success: false, error: "Network error" });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    if (failCount > 0) {
      alert(`Deleted ${successCount} evaluations. ${failCount} failed.`);
    }

    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
    setIsDeleting(false);
    await fetchEvaluations();
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setProviderFilter("all");
    setTriggerFilter("all");
  };

  const hasActiveFilters = searchQuery || statusFilter !== "all" || providerFilter !== "all" || triggerFilter !== "all";

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search by model or provider..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
            </select>

            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Providers</option>
              {providers.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            <select
              value={triggerFilter}
              onChange={(e) => setTriggerFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Triggers</option>
              {triggers.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Selection controls and bulk actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Selection controls */}
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={selectAll}
              className="text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Select all
            </button>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <button
              onClick={selectNone}
              className="text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Select none
            </button>
            {selectedIds.size > 0 && (
              <span className="text-gray-600 dark:text-gray-400 ml-2">
                {selectedIds.size} selected
              </span>
            )}
          </div>

          {/* Bulk delete button */}
          {selectedIds.size > 0 && (
            <div className="relative">
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-1.5">
                  <span className="text-sm text-red-700 dark:text-red-300">
                    Delete {selectedIds.size} evaluation{selectedIds.size !== 1 ? "s" : ""}?
                  </span>
                  <button
                    onClick={handleBulkDelete}
                    disabled={isDeleting}
                    className="px-2 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                  >
                    {isDeleting ? "Deleting..." : "Yes"}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                    className="px-2 py-1 text-gray-600 dark:text-gray-400 text-sm hover:text-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Selected
                </button>
              )}
            </div>
          )}
        </div>

        {/* Status info and refresh */}
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            Showing {filteredEvaluations.length} of {evaluations.length}
          </span>
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            {hasRunning ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                <span>Auto-refreshing</span>
              </>
            ) : (
              <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
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
      </div>

      {/* Evaluations table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-4 py-3 text-left w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.size > 0 && selectedIds.size === selectableIds.size}
                  onChange={() => selectedIds.size === selectableIds.size ? selectNone() : selectAll()}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
              </th>
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
            {filteredEvaluations.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                >
                  {evaluations.length === 0
                    ? "No evaluations yet. Run your first evaluation to get started."
                    : "No evaluations match your filters."}
                </td>
              </tr>
            ) : (
              filteredEvaluations.map((evaluation) => {
                const isSelectable = evaluation.status !== "running" && evaluation.status !== "pending";
                return (
                  <tr
                    key={evaluation.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-900/50 ${
                      selectedIds.has(evaluation.id) ? "bg-indigo-50 dark:bg-indigo-900/20" : ""
                    }`}
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(evaluation.id)}
                        onChange={() => toggleSelect(evaluation.id)}
                        disabled={!isSelectable}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-30"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <Link
                          href={`/admin/models/${evaluation.model.id}`}
                          className="font-medium text-gray-900 dark:text-gray-100 hover:text-indigo-600 dark:hover:text-indigo-400"
                        >
                          {evaluation.model.name}
                        </Link>
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
                );
              })
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
