"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ParentBenchCategory } from "@/types/parentbench";
import { PARENTBENCH_CATEGORY_META } from "@/lib/constants";
import { TimeRangeSelector, type TimeRange } from "@/components/ui/time-range-selector";
import { CategoryLegend, type CategoryVisibility } from "@/components/ui/category-legend";
import { EmptyState } from "@/components/ui/empty-state";

export type ScoreHistoryDataPoint = {
  date: string;
  overallScore: number;
  overallGrade: string;
  categoryScores?: Array<{
    category: string;
    score: number;
    grade: string;
    passRate: number;
    testCount: number;
  }>;
};

type ScoreHistoryChartProps = {
  data: ScoreHistoryDataPoint[];
  modelName?: string;
  timeRange?: TimeRange;
  onTimeRangeChange?: (range: TimeRange) => void;
  showTimeRangeSelector?: boolean;
  showCategoryToggle?: boolean;
  height?: number;
  className?: string;
};

// Beautiful gradient colors for Recharts
const CHART_COLORS: Record<ParentBenchCategory | "overall", string> = {
  overall: "#171717", // foreground
  age_inappropriate_content: "#3B82F6", // blue-500
  manipulation_resistance: "#A855F7", // purple-500
  data_privacy_minors: "#F59E0B", // amber-500
  parental_controls_respect: "#14B8A6", // teal-500
};

// Stroke patterns for accessibility (distinguish lines by shape, not just color)
const LINE_STROKE_DASHARRAY: Record<ParentBenchCategory | "overall", string> = {
  overall: "0",
  age_inappropriate_content: "5 5",
  manipulation_resistance: "3 3",
  data_privacy_minors: "8 4",
  parental_controls_respect: "2 2 6 2",
};

function formatDateLabel(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTooltipDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Custom tooltip component for better styling
function CustomTooltip({
  active,
  payload,
  label,
  chartData,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
  chartData: Array<Record<string, number | string>>;
}) {
  if (!active || !payload?.length) return null;

  const datePoint = chartData.find((d) => d.dateLabel === label);

  return (
    <div className="rounded-xl border border-card-border bg-card-bg/95 backdrop-blur-sm p-4 shadow-lg elevation-3">
      <p className="mb-3 text-sm font-semibold border-b border-card-border pb-2">
        {datePoint ? formatTooltipDate(datePoint.date as string) : label}
      </p>
      <div className="space-y-2">
        {payload.map((entry, index) => (
          <div
            key={`${String(entry.dataKey)}-${index}`}
            className="flex items-center justify-between gap-4 text-sm"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted">
                {entry.dataKey === "overall"
                  ? "Overall"
                  : PARENTBENCH_CATEGORY_META[
                      entry.dataKey as ParentBenchCategory
                    ]?.label || String(entry.dataKey)}
              </span>
            </div>
            <span className="font-bold tabular-nums">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScoreHistoryChart({
  data,
  modelName,
  timeRange = "ALL",
  onTimeRangeChange,
  showTimeRangeSelector = true,
  showCategoryToggle = true,
  height = 300,
  className = "",
}: ScoreHistoryChartProps) {
  const [showOverall, setShowOverall] = useState(true);
  const [categoryVisibility, setCategoryVisibility] = useState<CategoryVisibility>({
    age_inappropriate_content: true,
    manipulation_resistance: true,
    data_privacy_minors: true,
    parental_controls_respect: true,
  });

  // Transform data for Recharts
  const chartData = useMemo(() => {
    return data.map((point) => {
      const transformed: Record<string, number | string> = {
        date: point.date,
        dateLabel: formatDateLabel(point.date),
        overall: point.overallScore,
        overallGrade: point.overallGrade,
      };

      // Add category scores
      if (point.categoryScores) {
        for (const cs of point.categoryScores) {
          transformed[cs.category] = cs.score;
          transformed[`${cs.category}_grade`] = cs.grade;
        }
      }

      return transformed;
    });
  }, [data]);

  const toggleCategory = (category: ParentBenchCategory) => {
    setCategoryVisibility((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  if (data.length === 0) {
    return (
      <div className={className}>
        <EmptyState variant="no-history" />
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        {modelName && (
          <h3 className="text-lg font-semibold tracking-tight">
            Score History for {modelName}
          </h3>
        )}
        {showTimeRangeSelector && onTimeRangeChange && (
          <TimeRangeSelector value={timeRange} onChange={onTimeRangeChange} />
        )}
      </div>

      {/* Chart */}
      <div style={{ height }} className="select-none">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
          >
            <defs>
              {/* Gradient for overall line */}
              <linearGradient id="overallGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.overall} stopOpacity={0.8} />
                <stop offset="100%" stopColor={CHART_COLORS.overall} stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--card-border)"
              opacity={0.5}
              vertical={false}
            />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 12, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--card-border)" }}
              dy={8}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}`}
              dx={-8}
            />
            <Tooltip
              content={<CustomTooltip chartData={chartData} />}
              cursor={{
                stroke: "var(--muted)",
                strokeWidth: 1,
                strokeDasharray: "4 4",
              }}
            />

            {/* Overall line */}
            {showOverall && (
              <Line
                type="monotone"
                dataKey="overall"
                stroke={CHART_COLORS.overall}
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 0, fill: CHART_COLORS.overall }}
                activeDot={{
                  r: 6,
                  stroke: "var(--card-bg)",
                  strokeWidth: 2,
                  fill: CHART_COLORS.overall,
                }}
                name="Overall"
              />
            )}

            {/* Category lines */}
            {(Object.keys(categoryVisibility) as ParentBenchCategory[]).map(
              (category) =>
                categoryVisibility[category] && (
                  <Line
                    key={category}
                    type="monotone"
                    dataKey={category}
                    stroke={CHART_COLORS[category]}
                    strokeWidth={2}
                    strokeDasharray={LINE_STROKE_DASHARRAY[category]}
                    dot={{ r: 3, strokeWidth: 0, fill: CHART_COLORS[category] }}
                    activeDot={{
                      r: 5,
                      stroke: "var(--card-bg)",
                      strokeWidth: 2,
                      fill: CHART_COLORS[category],
                    }}
                    name={PARENTBENCH_CATEGORY_META[category].label}
                  />
                )
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Category Legend */}
      {showCategoryToggle && (
        <CategoryLegend
          visibility={categoryVisibility}
          onChange={toggleCategory}
          showOverall={true}
          overallVisible={showOverall}
          onOverallChange={() => setShowOverall(!showOverall)}
          className="mt-6 pt-4 border-t border-card-border"
        />
      )}
    </div>
  );
}
