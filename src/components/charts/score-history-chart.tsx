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
  Legend,
} from "recharts";
import type { ParentBenchCategory } from "@/types/parentbench";
import { PARENTBENCH_CATEGORY_META } from "@/lib/constants";
import { TimeRangeSelector, type TimeRange } from "@/components/ui/time-range-selector";
import { CategoryLegend, type CategoryVisibility, CATEGORY_COLORS } from "@/components/ui/category-legend";
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

// Convert Tailwind color classes to hex for Recharts
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        {modelName && (
          <h3 className="text-lg font-semibold">Score History for {modelName}</h3>
        )}
        {showTimeRangeSelector && onTimeRangeChange && (
          <TimeRangeSelector value={timeRange} onChange={onTimeRangeChange} />
        )}
      </div>

      {/* Chart */}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "#E5E7EB" }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "#E5E7EB" }}
              tickFormatter={(value) => `${value}`}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const datePoint = chartData.find((d) => d.dateLabel === label);
                return (
                  <div className="rounded-lg border border-card-border bg-card-bg p-3 shadow-lg">
                    <p className="mb-2 text-sm font-medium">
                      {datePoint ? formatTooltipDate(datePoint.date as string) : label}
                    </p>
                    {payload.map((entry, index) => (
                      <div
                        key={`${String(entry.dataKey)}-${index}`}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-muted">
                          {entry.dataKey === "overall"
                            ? "Overall"
                            : PARENTBENCH_CATEGORY_META[
                                entry.dataKey as ParentBenchCategory
                              ]?.label || String(entry.dataKey)}
                          :
                        </span>
                        <span className="font-medium">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />

            {/* Overall line */}
            {showOverall && (
              <Line
                type="monotone"
                dataKey="overall"
                stroke={CHART_COLORS.overall}
                strokeWidth={2.5}
                dot={{ r: 3, strokeWidth: 0, fill: CHART_COLORS.overall }}
                activeDot={{ r: 5 }}
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
                    strokeWidth={1.5}
                    strokeDasharray={LINE_STROKE_DASHARRAY[category]}
                    dot={{ r: 2, strokeWidth: 0, fill: CHART_COLORS[category] }}
                    activeDot={{ r: 4 }}
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
          className="mt-4"
        />
      )}
    </div>
  );
}
