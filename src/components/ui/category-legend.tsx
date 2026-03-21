"use client";

import type { ParentBenchCategory } from "@/types/parentbench";
import { PARENTBENCH_CATEGORY_META } from "@/lib/constants";

export type CategoryVisibility = Record<ParentBenchCategory, boolean>;

type CategoryLegendProps = {
  visibility: CategoryVisibility;
  onChange: (category: ParentBenchCategory) => void;
  showOverall?: boolean;
  overallVisible?: boolean;
  onOverallChange?: () => void;
  className?: string;
};

// Colors for each category (matching chart lines)
const CATEGORY_COLORS: Record<ParentBenchCategory | "overall", string> = {
  overall: "bg-foreground",
  age_inappropriate_content: "bg-blue-500",
  manipulation_resistance: "bg-purple-500",
  data_privacy_minors: "bg-amber-500",
  parental_controls_respect: "bg-teal-500",
};

// Short labels for the legend
const CATEGORY_SHORT_LABELS: Record<ParentBenchCategory | "overall", string> = {
  overall: "Overall",
  age_inappropriate_content: "Age Content",
  manipulation_resistance: "Manipulation",
  data_privacy_minors: "Privacy",
  parental_controls_respect: "Parental",
};

export function CategoryLegend({
  visibility,
  onChange,
  showOverall = true,
  overallVisible = true,
  onOverallChange,
  className = "",
}: CategoryLegendProps) {
  const categories = Object.keys(PARENTBENCH_CATEGORY_META) as ParentBenchCategory[];

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {showOverall && (
        <button
          onClick={onOverallChange}
          className={`inline-flex items-center gap-1.5 text-sm transition-opacity ${
            overallVisible ? "opacity-100" : "opacity-40"
          }`}
          aria-pressed={overallVisible}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY_COLORS.overall}`} />
          <span className="font-medium">Overall</span>
        </button>
      )}
      {categories.map((category) => {
        const isVisible = visibility[category];
        return (
          <button
            key={category}
            onClick={() => onChange(category)}
            className={`inline-flex items-center gap-1.5 text-sm transition-opacity ${
              isVisible ? "opacity-100" : "opacity-40"
            }`}
            aria-pressed={isVisible}
            title={PARENTBENCH_CATEGORY_META[category].label}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY_COLORS[category]}`} />
            <span>{CATEGORY_SHORT_LABELS[category]}</span>
          </button>
        );
      })}
    </div>
  );
}

export { CATEGORY_COLORS, CATEGORY_SHORT_LABELS };
