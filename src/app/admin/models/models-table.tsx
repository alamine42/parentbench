"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

type EvalTier = "active" | "standard" | "maintenance" | "paused";

interface Model {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  evalTier: EvalTier;
  createdAt: Date;
  provider: {
    id: string;
    name: string;
    slug: string;
  };
  latestScore: {
    overallScore: number;
    overallGrade: string;
    computedAt: Date;
  } | null;
}

interface ModelsTableProps {
  models: Model[];
  providers: string[];
}

type SortKey = "name" | "provider" | "score" | "evalDate" | "status" | "tier";
type SortOrder = "asc" | "desc";

const TIER_ORDER: Record<EvalTier, number> = {
  active: 0,
  standard: 1,
  maintenance: 2,
  paused: 3,
};

const TIER_INFO: Record<EvalTier, { label: string; description: string; color: string }> = {
  active: {
    label: "Active",
    description: "Weekly (3 runs)",
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  standard: {
    label: "Standard",
    description: "Bi-weekly (3 runs)",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  maintenance: {
    label: "Maintenance",
    description: "Monthly (3 runs)",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  paused: {
    label: "Paused",
    description: "Manual only",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400",
  },
};

export function ModelsTable({ models, providers }: ModelsTableProps) {
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [updatingTier, setUpdatingTier] = useState<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const handleTierChange = async (modelId: string, newTier: EvalTier) => {
    setUpdatingTier(modelId);
    try {
      const response = await fetch("/api/admin/models", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: modelId, evalTier: newTier }),
      });
      if (!response.ok) {
        throw new Error("Failed to update tier");
      }
      // Refresh the page to show updated data
      window.location.reload();
    } catch (error) {
      console.error("Failed to update tier:", error);
      alert("Failed to update evaluation tier");
    } finally {
      setUpdatingTier(null);
    }
  };

  const filteredAndSortedModels = useMemo(() => {
    let result = [...models];

    // Apply provider filter
    if (providerFilter !== "all") {
      result = result.filter((m) => m.provider.name === providerFilter);
    }

    // Apply status filter
    if (statusFilter !== "all") {
      const isActive = statusFilter === "active";
      result = result.filter((m) => m.isActive === isActive);
    }

    // Apply tier filter
    if (tierFilter !== "all") {
      result = result.filter((m) => m.evalTier === tierFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortKey) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "provider":
          comparison = a.provider.name.localeCompare(b.provider.name);
          break;
        case "score":
          const scoreA = a.latestScore?.overallScore ?? -1;
          const scoreB = b.latestScore?.overallScore ?? -1;
          comparison = scoreA - scoreB;
          break;
        case "evalDate":
          const dateA = a.latestScore?.computedAt
            ? new Date(a.latestScore.computedAt).getTime()
            : 0;
          const dateB = b.latestScore?.computedAt
            ? new Date(b.latestScore.computedAt).getTime()
            : 0;
          comparison = dateA - dateB;
          break;
        case "status":
          comparison = (a.isActive ? 1 : 0) - (b.isActive ? 1 : 0);
          break;
        case "tier":
          comparison = TIER_ORDER[a.evalTier] - TIER_ORDER[b.evalTier];
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [models, providerFilter, statusFilter, tierFilter, sortKey, sortOrder]);

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortOrder === "asc" ? (
      <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="provider-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Provider:
          </label>
          <select
            id="provider-filter"
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="all">All Providers</option>
            {providers.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="status-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Status:
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="tier-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Eval Tier:
          </label>
          <select
            id="tier-filter"
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="all">All Tiers</option>
            <option value="active">Active (Weekly)</option>
            <option value="standard">Standard (Bi-weekly)</option>
            <option value="maintenance">Maintenance (Monthly)</option>
            <option value="paused">Paused (Manual)</option>
          </select>
        </div>

        <div className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
          Showing {filteredAndSortedModels.length} of {models.length} models
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-1">
                  Model
                  <SortIcon columnKey="name" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort("provider")}
              >
                <div className="flex items-center gap-1">
                  Provider
                  <SortIcon columnKey="provider" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort("score")}
              >
                <div className="flex items-center gap-1">
                  Latest Score
                  <SortIcon columnKey="score" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort("evalDate")}
              >
                <div className="flex items-center gap-1">
                  Latest Eval
                  <SortIcon columnKey="evalDate" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center gap-1">
                  Status
                  <SortIcon columnKey="status" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => handleSort("tier")}
              >
                <div className="flex items-center gap-1">
                  Eval Tier
                  <SortIcon columnKey="tier" />
                </div>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredAndSortedModels.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                >
                  No models match the selected filters.
                </td>
              </tr>
            ) : (
              filteredAndSortedModels.map((model) => (
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
                      ? formatRelativeTime(new Date(model.latestScore.computedAt).toISOString())
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
                  <td className="px-6 py-4">
                    <select
                      value={model.evalTier}
                      onChange={(e) => handleTierChange(model.id, e.target.value as EvalTier)}
                      disabled={updatingTier === model.id}
                      className={`px-2 py-1 text-xs font-medium rounded-lg border-0 cursor-pointer focus:ring-2 focus:ring-indigo-500 ${TIER_INFO[model.evalTier].color} ${updatingTier === model.id ? "opacity-50 cursor-wait" : ""}`}
                      title={TIER_INFO[model.evalTier].description}
                    >
                      {(Object.keys(TIER_INFO) as EvalTier[]).map((tier) => (
                        <option key={tier} value={tier}>
                          {TIER_INFO[tier].label}
                        </option>
                      ))}
                    </select>
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

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
