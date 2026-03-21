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
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link href="/leaderboard" className="hover:text-foreground">
          Leaderboard
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/model/${slug}`} className="hover:text-foreground">
          {data?.modelName || slug}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">History</span>
      </nav>

      {/* Header */}
      <header className="mt-6 mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Score History</h1>
            {data && (
              <p className="mt-1 text-lg text-muted">
                {data.modelName} by {data.provider.name}
              </p>
            )}
          </div>

          {/* Time Range Selector */}
          <TimeRangeSelector value={timeRange} onChange={handleTimeRangeChange} />
        </div>

        {/* Trend Summary */}
        {data?.trend && data.history.length >= 2 && (
          <div className="mt-4 inline-flex items-center gap-3 rounded-lg border border-card-border bg-card-bg px-4 py-2">
            <span className="text-sm text-muted">
              {timeRange === "ALL" ? "All-time" : `Last ${timeRange.toLowerCase()}`} change:
            </span>
            <ScoreDelta delta={data.trend.changeAbsolute} size="lg" />
            <span className="text-sm text-muted">
              ({data.trend.changePercent > 0 ? "+" : ""}
              {data.trend.changePercent.toFixed(1)}%)
            </span>
          </div>
        )}
      </header>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-foreground" />
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20">
          <p className="text-red-700 dark:text-red-400">{error}</p>
          <button
            onClick={fetchHistory}
            className="mt-4 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && data?.history.length === 0 && (
        <EmptyState
          variant="no-history"
          action={{
            label: "View Model Details",
            href: `/model/${slug}`,
          }}
        />
      )}

      {/* Chart */}
      {!isLoading && !error && data && data.history.length > 0 && (
        <div className="rounded-2xl border border-card-border bg-card-bg p-6">
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
      {!isLoading && !error && data && data.history.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-card-border bg-card-bg p-4">
            <p className="text-sm text-muted">Data Points</p>
            <p className="mt-1 text-2xl font-bold">{data.history.length}</p>
          </div>
          <div className="rounded-xl border border-card-border bg-card-bg p-4">
            <p className="text-sm text-muted">Latest Score</p>
            <p className="mt-1 text-2xl font-bold">
              {data.history[data.history.length - 1]?.overallScore ?? "-"}
            </p>
          </div>
          <div className="rounded-xl border border-card-border bg-card-bg p-4">
            <p className="text-sm text-muted">Average Score</p>
            <p className="mt-1 text-2xl font-bold">
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
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
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
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to model details
        </Link>
      </div>
    </div>
  );
}
