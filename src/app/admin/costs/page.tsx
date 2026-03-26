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
      fetchData(); // Refresh to show new budget
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save budget");
    } finally {
      setSavingBudget(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading cost data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const maxCost = Math.max(...data.timeSeries.map((d) => d.costUsd), 0.01);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Cost Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track evaluation costs and manage budget alerts
          </p>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {([7, 30, 90] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === p
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Spend"
          value={`$${data.summary.totalCostUsd.toFixed(2)}`}
          subtitle={`${period} day period`}
          color="indigo"
        />
        <SummaryCard
          title="Evaluations"
          value={data.summary.evaluationCount.toString()}
          subtitle={`$${data.summary.evaluationCount > 0 ? (data.summary.totalCostUsd / data.summary.evaluationCount).toFixed(3) : "0"}/eval avg`}
          color="green"
        />
        <SummaryCard
          title="Input Tokens"
          value={formatTokens(data.summary.totalInputTokens)}
          subtitle="Total processed"
          color="blue"
        />
        <SummaryCard
          title="Output Tokens"
          value={formatTokens(data.summary.totalOutputTokens)}
          subtitle="Total generated"
          color="purple"
        />
      </div>

      {/* Budget alert */}
      {data.budget && (
        <div
          className={`rounded-xl p-4 border ${
            data.budget.isOverBudget
              ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
              : data.budget.percentUsed >= 80
              ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
              : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
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
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  Budget: ${data.budget.currentSpendUsd.toFixed(2)} / ${data.budget.thresholdUsd.toFixed(2)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {data.budget.percentUsed.toFixed(1)}% used ({data.budget.periodDays}-day period)
                </p>
              </div>
            </div>
            <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  data.budget.isOverBudget
                    ? "bg-red-500"
                    : data.budget.percentUsed >= 80
                    ? "bg-yellow-500"
                    : "bg-green-500"
                }`}
                style={{ width: `${Math.min(data.budget.percentUsed, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Set budget button */}
      {!showBudgetForm && (
        <button
          onClick={() => setShowBudgetForm(true)}
          className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium"
        >
          {data.budget ? "Update budget alert" : "Set budget alert"} →
        </button>
      )}

      {/* Budget form */}
      {showBudgetForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Set Budget Alert</h3>
          <div className="flex items-end gap-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Threshold (USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={budgetThreshold}
                onChange={(e) => setBudgetThreshold(e.target.value)}
                placeholder="100.00"
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-32"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Period
              </label>
              <select
                value={budgetPeriod}
                onChange={(e) => setBudgetPeriod(parseInt(e.target.value) as 7 | 30 | 90)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>
            <button
              onClick={handleSaveBudget}
              disabled={savingBudget || !budgetThreshold}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {savingBudget ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setShowBudgetForm(false)}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Cost chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Spending Over Time
        </h2>
        {data.timeSeries.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-500 dark:text-gray-400">
            No cost data for this period
          </div>
        ) : (
          <div className="h-48">
            <div className="flex items-end justify-between h-full gap-1">
              {data.timeSeries.map((point, i) => (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-1"
                  title={`${point.date}: $${point.costUsd.toFixed(3)} (${point.evaluationCount} evals)`}
                >
                  <div
                    className="w-full bg-indigo-500 rounded-t transition-all hover:bg-indigo-600 cursor-pointer"
                    style={{
                      height: `${(point.costUsd / maxCost) * 100}%`,
                      minHeight: point.costUsd > 0 ? "4px" : "0",
                    }}
                  />
                  {i % Math.ceil(data.timeSeries.length / 7) === 0 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate w-full text-center">
                      {new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cost by model */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Cost by Model
          </h2>
        </div>
        {data.byModel.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
            No model cost data for this period
          </div>
        ) : (
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
                  Evaluations
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
                <tr key={model.modelId} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                    {model.modelName}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {model.providerName}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">
                    {model.evaluationCount}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-gray-100">
                    ${model.totalCostUsd.toFixed(3)}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">
                    ${(model.totalCostUsd / model.evaluationCount).toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Alert history */}
      {data.alertHistory.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Recent Budget Alerts
            </h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.alertHistory.map((alert) => (
              <div key={alert.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {alert.alertName}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    ${alert.currentSpend.toFixed(2)} / ${alert.thresholdUsd.toFixed(2)}
                  </p>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(alert.triggeredAt).toLocaleString()}
                </span>
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
}: {
  title: string;
  value: string;
  subtitle: string;
  color: "indigo" | "green" | "blue" | "purple";
}) {
  const colorClasses = {
    indigo: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400",
    green: "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400",
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
    purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
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
