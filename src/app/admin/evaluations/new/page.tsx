"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Model {
  id: string;
  name: string;
  slug: string;
  provider: string;
  hasScore: boolean;
}

interface RunningEvaluation {
  id: string;
  status: string;
  totalTestCases: number;
  completedTestCases: number;
  failedTestCases: number;
  model: {
    id: string;
    name: string;
    slug: string;
  };
}

export default function NewEvaluationPage() {
  const router = useRouter();
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [results, setResults] = useState<Array<{ modelName: string; success: boolean; error?: string }>>([]);
  const [filter, setFilter] = useState<"all" | "unevaluated">("all");
  const [runningEvaluations, setRunningEvaluations] = useState<RunningEvaluation[]>([]);
  const [hasTriggered, setHasTriggered] = useState(false);

  // Fetch running evaluations
  const fetchRunningEvaluations = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/evaluations");
      if (response.ok) {
        const data = await response.json();
        const running = data.evaluations.filter(
          (e: RunningEvaluation) => e.status === "running" || e.status === "pending"
        );
        setRunningEvaluations(running);

        // If all evaluations are complete, refresh models list to update "Evaluated" badges
        if (running.length === 0 && hasTriggered) {
          const modelsResponse = await fetch("/api/admin/models");
          if (modelsResponse.ok) {
            const modelsData = await modelsResponse.json();
            setModels(modelsData.models || []);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch evaluations:", error);
    }
  }, [hasTriggered]);

  // Auto-refresh when evaluations are running
  useEffect(() => {
    if (!hasTriggered) return;

    // Initial fetch
    fetchRunningEvaluations();

    // Poll every 3 seconds
    const interval = setInterval(fetchRunningEvaluations, 3000);
    return () => clearInterval(interval);
  }, [hasTriggered, fetchRunningEvaluations]);

  // Fetch models on mount
  useEffect(() => {
    async function fetchModels() {
      try {
        const response = await fetch("/api/admin/models");
        if (response.ok) {
          const data = await response.json();
          setModels(data.models || []);
        }
      } catch (error) {
        console.error("Failed to fetch models:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchModels();
  }, []);

  const filteredModels = filter === "all"
    ? models
    : models.filter(m => !m.hasScore);

  const toggleModel = (modelId: string) => {
    const newSelected = new Set(selectedModels);
    if (newSelected.has(modelId)) {
      newSelected.delete(modelId);
    } else {
      newSelected.add(modelId);
    }
    setSelectedModels(newSelected);
  };

  const selectAll = () => {
    setSelectedModels(new Set(filteredModels.map(m => m.id)));
  };

  const selectNone = () => {
    setSelectedModels(new Set());
  };

  const triggerEvaluations = async () => {
    if (selectedModels.size === 0) return;

    setTriggering(true);
    setResults([]);

    const newResults: typeof results = [];

    for (const modelId of selectedModels) {
      const model = models.find(m => m.id === modelId);
      if (!model) continue;

      try {
        const response = await fetch("/api/admin/evaluations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelId }),
        });

        if (response.ok) {
          newResults.push({ modelName: model.name, success: true });
        } else {
          const error = await response.json();
          newResults.push({ modelName: model.name, success: false, error: error.error });
        }
      } catch (error) {
        newResults.push({
          modelName: model.name,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }

      setResults([...newResults]);
    }

    setTriggering(false);
    setHasTriggered(true);
  };

  const successCount = results.filter(r => r.success).length;
  const allComplete = results.length === selectedModels.size && results.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Run Evaluations
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Select models to evaluate with LLM-as-Judge
          </p>
        </div>
        <Link
          href="/admin/evaluations"
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          Back to Evaluations
        </Link>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium">LLM-as-Judge Enabled</p>
            <p className="mt-1 text-blue-700 dark:text-blue-300">
              Evaluations use Claude to semantically judge model responses for child safety.
              Each evaluation takes 1-3 minutes per model depending on test case count.
            </p>
          </div>
        </div>
      </div>

      {/* Filter and selection controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
          >
            <option value="all">All models ({models.length})</option>
            <option value="unevaluated">Unevaluated only ({models.filter(m => !m.hasScore).length})</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Select all
            </button>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <button
              onClick={selectNone}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Select none
            </button>
          </div>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {selectedModels.size} selected
        </div>
      </div>

      {/* Models list */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
            Loading models...
          </div>
        ) : filteredModels.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
            {filter === "unevaluated" ? "All models have been evaluated!" : "No models found"}
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
            {filteredModels.map((model) => (
              <label
                key={model.id}
                className={`flex items-center gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 cursor-pointer ${
                  selectedModels.has(model.id) ? "bg-indigo-50 dark:bg-indigo-900/20" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedModels.has(model.id)}
                  onChange={() => toggleModel(model.id)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {model.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {model.provider} &middot; {model.slug}
                  </p>
                </div>
                {model.hasScore ? (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    Evaluated
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                    Not evaluated
                  </span>
                )}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
            Results ({successCount}/{results.length} triggered)
          </h3>
          <div className="space-y-2">
            {results.map((result, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                {result.success ? (
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                <span className={result.success ? "text-gray-700 dark:text-gray-300" : "text-red-600 dark:text-red-400"}>
                  {result.modelName}
                  {result.error && `: ${result.error}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Progress */}
      {runningEvaluations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              Live Progress ({runningEvaluations.length} running)
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Auto-refreshing every 3s
            </span>
          </div>
          <div className="space-y-4">
            {runningEvaluations.map((evaluation) => (
              <div key={evaluation.id} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {evaluation.model.name}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400 tabular-nums">
                    {evaluation.completedTestCases}/{evaluation.totalTestCases} test cases
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-indigo-600 transition-all duration-300"
                      style={{
                        width: `${
                          evaluation.totalTestCases > 0
                            ? (evaluation.completedTestCases / evaluation.totalTestCases) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums w-12 text-right">
                    {evaluation.totalTestCases > 0
                      ? Math.round((evaluation.completedTestCases / evaluation.totalTestCases) * 100)
                      : 0}%
                  </span>
                </div>
                {evaluation.failedTestCases > 0 && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {evaluation.failedTestCases} test case(s) failed
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed message */}
      {hasTriggered && runningEvaluations.length === 0 && results.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div className="text-sm text-green-800 dark:text-green-200">
              <p className="font-medium">All evaluations complete!</p>
              <p className="mt-1 text-green-700 dark:text-green-300">
                View results on the{" "}
                <Link href="/admin/evaluations" className="underline hover:no-underline">
                  evaluations page
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button
          onClick={triggerEvaluations}
          disabled={selectedModels.size === 0 || triggering}
          className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {triggering ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Triggering...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Run {selectedModels.size} Evaluation{selectedModels.size !== 1 ? "s" : ""}
            </>
          )}
        </button>

        {allComplete && (
          <button
            onClick={() => router.push("/admin/evaluations")}
            className="px-6 py-3 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
          >
            View Evaluations
          </button>
        )}
      </div>
    </div>
  );
}
