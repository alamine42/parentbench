"use client";

import { useState } from "react";
import type { ParentBenchCategory } from "@/types/parentbench";
import { PARENTBENCH_CATEGORY_META } from "@/lib/constants";
import { LetterGradeBadge } from "@/components/ui/letter-grade";
import type { LetterGrade } from "@/types/model";

type CategoryData = {
  modelSlug: string;
  modelName: string;
  score: number;
  grade: string;
  passRate: number;
  isBest: boolean;
};

type CategoryComparisonBarProps = {
  category: ParentBenchCategory;
  data: CategoryData[];
  className?: string;
};

// Gradient colors for visual distinction
const MODEL_GRADIENTS = [
  "from-blue-500 to-blue-600",
  "from-purple-500 to-purple-600",
  "from-teal-500 to-teal-600",
  "from-amber-500 to-amber-600",
];

const MODEL_BG_COLORS = [
  "bg-blue-50 dark:bg-blue-900/20",
  "bg-purple-50 dark:bg-purple-900/20",
  "bg-teal-50 dark:bg-teal-900/20",
  "bg-amber-50 dark:bg-amber-900/20",
];

export function CategoryComparisonBar({
  category,
  data,
  className = "",
}: CategoryComparisonBarProps) {
  const meta = PARENTBENCH_CATEGORY_META[category];
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);

  return (
    <div className={`rounded-xl border border-card-border bg-card-bg overflow-hidden transition-all duration-200 hover:border-muted elevation-1 hover:elevation-2 ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-card-border bg-muted-bg/50">
        <h4 className="font-semibold text-sm">{meta.label}</h4>
        <p className="text-xs text-muted mt-0.5 line-clamp-1">{meta.question}</p>
      </div>

      {/* Bars */}
      <div className="p-4 space-y-3">
        {data.map((model, index) => {
          const isHovered = hoveredModel === model.modelSlug;
          const gradient = MODEL_GRADIENTS[index % MODEL_GRADIENTS.length];
          const bgColor = MODEL_BG_COLORS[index % MODEL_BG_COLORS.length];

          return (
            <div
              key={model.modelSlug}
              className={`flex items-center gap-3 rounded-lg p-2 -mx-2 transition-all duration-200 ${
                isHovered ? bgColor : ""
              }`}
              onMouseEnter={() => setHoveredModel(model.modelSlug)}
              onMouseLeave={() => setHoveredModel(null)}
            >
              {/* Model name - fixed width for alignment */}
              <div className="w-24 sm:w-28 shrink-0">
                <span className={`text-sm font-medium truncate block transition-colors duration-200 ${
                  model.isBest ? "text-foreground" : "text-muted"
                }`}>
                  {model.modelName}
                </span>
              </div>

              {/* Progress bar */}
              <div className="flex-1 min-w-0">
                <div className="h-2.5 sm:h-3 overflow-hidden rounded-full bg-muted-bg">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r ${gradient} ${
                      model.isBest ? "opacity-100" : "opacity-60"
                    }`}
                    style={{
                      width: `${model.score}%`,
                      transform: isHovered ? "scaleY(1.1)" : "scaleY(1)",
                    }}
                  />
                </div>
              </div>

              {/* Score and grade */}
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-sm font-bold tabular-nums transition-colors duration-200 ${
                  model.isBest ? "text-foreground" : "text-muted"
                }`}>
                  {model.score}
                </span>
                <LetterGradeBadge grade={model.grade as LetterGrade} size="sm" />
              </div>

              {/* Best indicator */}
              <div className="w-12 sm:w-14 text-right shrink-0">
                {model.isBest && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <span className="hidden sm:inline">Best</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
