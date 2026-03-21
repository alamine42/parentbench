"use client";

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

// Colors for each model position
const MODEL_COLORS = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-teal-500",
  "bg-amber-500",
];

export function CategoryComparisonBar({
  category,
  data,
  className = "",
}: CategoryComparisonBarProps) {
  const meta = PARENTBENCH_CATEGORY_META[category];

  return (
    <div className={`rounded-lg border border-card-border bg-card-bg p-4 ${className}`}>
      <div className="mb-3">
        <h4 className="text-sm font-semibold">{meta.label}</h4>
        <p className="text-xs text-muted">{meta.question}</p>
      </div>

      <div className="space-y-3">
        {data.map((model, index) => (
          <div key={model.modelSlug} className="flex items-center gap-3">
            {/* Model name */}
            <div className="w-24 shrink-0 text-sm truncate">
              {model.modelName}
            </div>

            {/* Progress bar */}
            <div className="flex-1">
              <div className="h-3 overflow-hidden rounded-full bg-muted-bg">
                <div
                  className={`h-full rounded-full transition-all ${MODEL_COLORS[index % MODEL_COLORS.length]} ${
                    model.isBest ? "opacity-100" : "opacity-60"
                  }`}
                  style={{ width: `${model.score}%` }}
                />
              </div>
            </div>

            {/* Score */}
            <div className="flex w-20 items-center justify-end gap-2">
              <span className="text-sm font-semibold tabular-nums">{model.score}</span>
              <LetterGradeBadge grade={model.grade as LetterGrade} size="sm" />
            </div>

            {/* Best indicator */}
            <div className="w-14 text-right">
              {model.isBest && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                  Best
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
