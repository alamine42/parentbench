"use client";

import { useState, useEffect, useCallback } from "react";

// ============================================================================
// TYPES
// ============================================================================

interface CostSummary {
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  evaluationCount: number;
  periodDays: number;
}

interface CostByModel {
  modelId: string;
  modelName: string;
  providerName: string;
  totalCostUsd: number;
  evaluationCount: number;
}

interface CostTimeSeries {
  date: string;
  costUsd: number;
  evaluationCount: number;
}

interface BudgetStatus {
  thresholdUsd: number;
  currentSpendUsd: number;
  percentUsed: number;
  isOverBudget: boolean;
  periodDays: number;
}

interface AlertHistoryEntry {
  id: string;
  alertName: string;
  triggeredAt: string;
  currentSpend: number;
  thresholdUsd: number;
  message: string | null;
}

interface CostData {
  summary: CostSummary;
  byModel: CostByModel[];
  timeSeries: CostTimeSeries[];
  budget: BudgetStatus | null;
  alertHistory: AlertHistoryEntry[];
}

// ============================================================================
// SKELETON LOADING COMPONENT
// ============================================================================

function CostsPageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="h-8 w-40 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded mt-2" />
        </div>
        <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>

      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            </div>
            <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded mt-3" />
            <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded mt-2" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
        <div className="h-48 flex items-end gap-1">
          {[20, 45, 30, 65, 40, 75, 55, 85, 35, 60, 50, 70, 25, 80].map((height, i) => (
            <div
              key={i}
              className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-t animate-pulse"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700/50 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CostsPage() {
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Budget form state
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetThreshold, setBudgetThreshold] = useState("");
  const [budgetPeriod, setBudgetPeriod] = useState<7 | 30 | 90>(30);
  const [savingBudget, setSavingBudget] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);

  // Tooltip state for chart
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/costs?period=${period}`);
      if (!response.ok) {
        throw new Error("Failed to fetch cost data");
      }
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveBudget = async () => {
    if (!budgetThreshold || parseFloat(budgetThreshold) <= 0) return;

    try {
      setSavingBudget(true);
      setBudgetError(null);
      const response = await fetch("/api/admin/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thresholdUsd: parseFloat(budgetThreshold),
          periodDays: budgetPeriod,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save budget");
      }

      setShowBudgetForm(false);
      fetchData();
    } catch (err) {
      setBudgetError(err instanceof Error ? err.message : "Failed to save budget");
    } finally {
      setSavingBudget(false);
    }
  };

  if (loading && !data) {
    return <CostsPageSkeleton />;
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-red-900 dark:text-red-100">Failed to load cost data</h3>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
          </div>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const maxCost = Math.max(...data.timeSeries.map((d) => d.costUsd), 0.01);
  const yAxisSteps = [0, maxCost * 0.25, maxCost * 0.5, maxCost * 0.75, maxCost];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Cost Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track evaluation costs and manage budget alerts
          </p>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 self-start sm:self-auto">
          {([7, 30, 90] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-gray-900 ${
                period === p
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              }`}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards - responsive grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <SummaryCard
          title="Total Spend"
          value={`$${data.summary.totalCostUsd.toFixed(2)}`}
          subtitle={`${period} day period`}
          color="indigo"
          icon="dollar"
        />
        <SummaryCard
          title="Evaluations"
          value={data.summary.evaluationCount.toString()}
          subtitle={`$${data.summary.evaluationCount > 0 ? (data.summary.totalCostUsd / data.summary.evaluationCount).toFixed(3) : "0"}/eval avg`}
          color="green"
          icon="chart"
        />
        <SummaryCard
          title="Input Tokens"
          value={formatTokens(data.summary.totalInputTokens)}
          subtitle="Total processed"
          color="blue"
          icon="input"
        />
        <SummaryCard
          title="Output Tokens"
          value={formatTokens(data.summary.totalOutputTokens)}
          subtitle="Total generated"
          color="purple"
          icon="output"
        />
      </div>

      {/* Budget alert - responsive layout */}
      {data.budget && (
        <div
          className={`rounded-xl p-4 border transition-colors ${
            data.budget.isOverBudget
              ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
              : data.budget.percentUsed >= 80
              ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
              : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  data.budget.isOverBudget
                    ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
                    : data.budget.percentUsed >= 80
                    ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400"
                    : "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400"
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  Budget: ${data.budget.currentSpendUsd.toFixed(2)} / ${data.budget.thresholdUsd.toFixed(2)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {data.budget.percentUsed.toFixed(1)}% used ({data.budget.periodDays}-day period)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 sm:w-40">
              <div className="flex-1 sm:w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    data.budget.isOverBudget
                      ? "bg-red-500"
                      : data.budget.percentUsed >= 80
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  }`}
                  style={{ width: `${Math.min(data.budget.percentUsed, 100)}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400 tabular-nums sm:hidden">
                {data.budget.percentUsed.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Set budget button */}
      {!showBudgetForm && (
        <button
          onClick={() => setShowBudgetForm(true)}
          className="inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 rounded"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          {data.budget ? "Update budget alert" : "Set budget alert"}
        </button>
      )}

      {/* Budget form - responsive layout */}
      {showBudgetForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Set Budget Alert</h3>

          {budgetError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{budgetError}</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-1 sm:flex-initial">
              <label htmlFor="budget-threshold" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Threshold (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                <input
                  id="budget-threshold"
                  type="number"
                  step="0.01"
                  min="0"
                  value={budgetThreshold}
                  onChange={(e) => setBudgetThreshold(e.target.value)}
                  placeholder="100.00"
                  className="pl-7 pr-3 py-2.5 w-full sm:w-32 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                />
              </div>
            </div>
            <div className="flex-1 sm:flex-initial">
              <label htmlFor="budget-period" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Period
              </label>
              <select
                id="budget-period"
                value={budgetPeriod}
                onChange={(e) => setBudgetPeriod(parseInt(e.target.value) as 7 | 30 | 90)}
                className="w-full sm:w-auto px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
              >
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={handleSaveBudget}
                disabled={savingBudget || !budgetThreshold}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
              >
                {savingBudget ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setShowBudgetForm(false);
                  setBudgetError(null);
                }}
                className="flex-1 sm:flex-initial px-4 py-2.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cost chart with Y-axis labels and tooltips */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Spending Over Time
        </h2>
        {data.timeSeries.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 gap-3">
            <svg className="w-12 h-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-sm">No cost data for this period</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Run some evaluations to see spending trends</p>
          </div>
        ) : (
          <div className="h-52 sm:h-56 relative">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-gray-500 dark:text-gray-400 text-right pr-2">
              {yAxisSteps.reverse().map((step, i) => (
                <span key={i} className="tabular-nums">${step.toFixed(2)}</span>
              ))}
            </div>

            {/* Chart area */}
            <div className="ml-14 h-full pb-8 relative">
              {/* Horizontal grid lines */}
              <div className="absolute inset-0 bottom-8 flex flex-col justify-between pointer-events-none">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="border-t border-gray-100 dark:border-gray-700/50" />
                ))}
              </div>

              {/* Bars */}
              <div className="flex items-end justify-between h-full gap-0.5 sm:gap-1 relative">
                {data.timeSeries.map((point, i) => (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center gap-1 relative group"
                    onMouseEnter={() => setHoveredBar(i)}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    {/* Tooltip */}
                    {hoveredBar === i && (
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                        <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                          <p className="font-medium">{new Date(point.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
                          <p className="text-gray-300 mt-1">${point.costUsd.toFixed(3)}</p>
                          <p className="text-gray-400">{point.evaluationCount} eval{point.evaluationCount !== 1 ? "s" : ""}</p>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
                        </div>
                      </div>
                    )}
                    <div
                      className={`w-full rounded-t transition-all cursor-pointer ${
                        hoveredBar === i ? "bg-indigo-600" : "bg-indigo-500"
                      }`}
                      style={{
                        height: `${(point.costUsd / maxCost) * 100}%`,
                        minHeight: point.costUsd > 0 ? "4px" : "0",
                      }}
                    />
                    {i % Math.ceil(data.timeSeries.length / 7) === 0 && (
                      <span className="absolute -bottom-6 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate w-full text-center">
                        {new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cost by model - responsive with card layout on mobile */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Cost by Model
          </h2>
        </div>
        {data.byModel.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400">No model cost data for this period</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Costs will appear after running evaluations</p>
          </div>
        ) : (
          <>
            {/* Desktop table view */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Model
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Provider
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Evals
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Total Cost
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Avg / Eval
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {data.byModel.map((model) => (
                    <tr key={model.modelId} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                        {model.modelName}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                        {model.providerName}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400 tabular-nums">
                        {model.evaluationCount}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                        ${model.totalCostUsd.toFixed(3)}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400 tabular-nums">
                        ${(model.totalCostUsd / model.evaluationCount).toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card view */}
            <div className="sm:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {data.byModel.map((model) => (
                <div key={model.modelId} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {model.modelName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {model.providerName}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                        ${model.totalCostUsd.toFixed(3)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {model.evaluationCount} eval{model.evaluationCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Avg per eval</span>
                    <span className="tabular-nums">${(model.totalCostUsd / model.evaluationCount).toFixed(4)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Alert history - responsive layout */}
      {data.alertHistory.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Recent Budget Alerts
            </h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.alertHistory.map((alert) => (
              <div key={alert.id} className="px-4 sm:px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {alert.alertName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                        ${alert.currentSpend.toFixed(2)} / ${alert.thresholdUsd.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400 sm:text-right ml-11 sm:ml-0">
                    {new Date(alert.triggeredAt).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SUB COMPONENTS
// ============================================================================

function SummaryCard({
  title,
  value,
  subtitle,
  color,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: "indigo" | "green" | "blue" | "purple";
  icon?: "dollar" | "chart" | "input" | "output";
}) {
  const colorClasses = {
    indigo: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400",
    green: "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400",
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
    purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
  };

  const icons = {
    dollar: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    chart: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    input: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    output: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</p>
        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClasses[color]}`}>
          {icons[icon || "dollar"]}
        </div>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2 tabular-nums">{value}</p>
      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">{subtitle}</p>
    </div>
  );
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(2)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}
