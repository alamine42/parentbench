"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ScoreHistoryChart, type ScoreHistoryDataPoint } from "@/components/charts";
import { ScoreDelta } from "@/components/ui/score-delta";
import { TimeRangeSelector, type TimeRange } from "@/components/ui/time-range-selector";
import { EmptyState } from "@/components/ui/empty-state";

type ScoreHistoryResponse = {
  success: boolean;
  data?: {
    modelId: string;
    modelSlug: string;
    modelName: string;
    provider: {
      id: string;
      name: string;
      slug: string;
      logoUrl: string | null;
    };
    timeRange: TimeRange;
    history: ScoreHistoryDataPoint[];
    trend: {
      direction: "up" | "down" | "stable";
      changePercent: number;
      changeAbsolute: number;
      periodStart: string | null;
      periodEnd: string | null;
    };
  };
  error?: string;
};

// Beautiful skeleton loader
function HistorySkeleton() {
  return (
    <div className="animate-in fade-in duration-300">
      {/* Header skeleton */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded skeleton-shimmer" />
          <div className="h-5 w-32 rounded skeleton-shimmer" />
        </div>
        <div className="h-10 w-56 rounded-xl skeleton-shimmer" />
      </div>

      {/* Trend summary skeleton */}
      <div className="h-12 w-64 rounded-lg skeleton-shimmer mb-8" />

      {/* Chart skeleton */}
      <div className="rounded-2xl border border-card-border overflow-hidden">
        <div className="h-96 skeleton-shimmer" />
      </div>

      {/* Stats skeleton */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl border border-card-border overflow-hidden">
            <div className="h-full skeleton-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ModelHistoryPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [timeRange, setTimeRange] = useState<TimeRange>("ALL");
  const [data, setData] = useState<ScoreHistoryResponse["data"] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/internal/models/${slug}/scores?range=${timeRange}&categories=true`
      );
      const result: ScoreHistoryResponse = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch score history");
      }

      setData(result.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [slug, timeRange]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 flex-wrap">
            <li>
              <Link href="/" className="hover:text-foreground transition-colors">
                Home
              </Link>
            </li>
            <li className="text-card-border">/</li>
            <li>
              <Link href="/leaderboard" className="hover:text-foreground transition-colors">
                Leaderboard
              </Link>
            </li>
            <li className="text-card-border">/</li>
            <li>
              <Link href={`/model/${slug}`} className="hover:text-foreground transition-colors">
                {data?.modelName || slug}
              </Link>
            </li>
            <li className="text-card-border">/</li>
            <li className="text-foreground font-medium">History</li>
          </ol>
        </nav>

        {/* Loading State */}
        {isLoading && <HistorySkeleton />}

        {/* Error State */}
        {!isLoading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-800/50 dark:bg-red-900/20">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="mx-auto mb-4 text-red-500"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <p className="text-red-700 dark:text-red-400 font-medium mb-4">{error}</p>
            <button
              onClick={fetchHistory}
              className="rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Content */}
        {!isLoading && !error && (
          <>
            {/* Header */}
            <header className="mb-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                    Score History
                  </h1>
                  {data && (
                    <p className="mt-2 text-lg text-muted">
                      {data.modelName} by {data.provider.name}
                    </p>
                  )}
                </div>

                {/* Time Range Selector */}
                <TimeRangeSelector value={timeRange} onChange={handleTimeRangeChange} />
              </div>

              {/* Trend Summary */}
              {data?.trend && data.history.length >= 2 && (
                <div className="mt-6 inline-flex items-center gap-4 rounded-xl border border-card-border bg-card-bg px-5 py-3 elevation-1">
                  <span className="text-sm text-muted">
                    {timeRange === "ALL" ? "All-time" : `Last ${timeRange.toLowerCase()}`} change:
                  </span>
                  <ScoreDelta delta={data.trend.changeAbsolute} size="lg" />
                  <span className="text-sm text-muted tabular-nums">
                    ({data.trend.changePercent > 0 ? "+" : ""}
                    {data.trend.changePercent.toFixed(1)}%)
                  </span>
                </div>
              )}
            </header>

            {/* Empty State */}
            {data?.history.length === 0 && (
              <EmptyState
                variant="no-history"
                action={{
                  label: "View Model Details",
                  href: `/model/${slug}`,
                }}
              />
            )}

            {/* Chart */}
            {data && data.history.length > 0 && (
              <div className="rounded-2xl border border-card-border bg-card-bg p-4 sm:p-6 elevation-1">
                <ScoreHistoryChart
                  data={data.history}
                  timeRange={timeRange}
                  showTimeRangeSelector={false}
                  showCategoryToggle={true}
                  height={400}
                />
              </div>
            )}

            {/* Stats Summary */}
            {data && data.history.length > 0 && (
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-card-border bg-card-bg p-5 elevation-1">
                  <p className="text-sm text-muted">Data Points</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums">{data.history.length}</p>
                </div>
                <div className="rounded-xl border border-card-border bg-card-bg p-5 elevation-1">
                  <p className="text-sm text-muted">Latest Score</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums">
                    {data.history[data.history.length - 1]?.overallScore ?? "-"}
                  </p>
                </div>
                <div className="rounded-xl border border-card-border bg-card-bg p-5 elevation-1">
                  <p className="text-sm text-muted">Average Score</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums">
                    {data.history.length > 0
                      ? (
                          data.history.reduce((sum, h) => sum + h.overallScore, 0) /
                          data.history.length
                        ).toFixed(1)
                      : "-"}
                  </p>
                </div>
              </div>
            )}

            {/* Back Link */}
            <div className="mt-8">
              <Link
                href={`/model/${slug}`}
                className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors group"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-transform group-hover:-translate-x-1"
                >
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back to model details
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
