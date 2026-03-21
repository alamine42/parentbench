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
  variant?: "horizontal" | "vertical";
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
  variant = "horizontal",
  className = "",
}: CategoryLegendProps) {
  const categories = Object.keys(PARENTBENCH_CATEGORY_META) as ParentBenchCategory[];

  const containerClass = variant === "horizontal"
    ? "flex flex-wrap items-center gap-2 sm:gap-3"
    : "flex flex-col gap-2";

  return (
    <div className={`${containerClass} ${className}`}>
      {showOverall && (
        <button
          onClick={onOverallChange}
          className={`group inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-all duration-200 tap-target ${
            overallVisible
              ? "bg-foreground/10 text-foreground"
              : "text-muted hover:text-foreground/70"
          }`}
          aria-pressed={overallVisible}
          title="Toggle overall score line"
        >
          <span
            className={`h-2.5 w-2.5 rounded-full transition-all duration-200 ${CATEGORY_COLORS.overall} ${
              overallVisible ? "opacity-100 scale-100" : "opacity-30 scale-75"
            }`}
          />
          <span className={`font-medium transition-opacity duration-200 ${
            overallVisible ? "opacity-100" : "opacity-50"
          }`}>
            Overall
          </span>
        </button>
      )}

      {/* Divider */}
      {showOverall && variant === "horizontal" && (
        <div className="hidden sm:block h-4 w-px bg-card-border" />
      )}

      {categories.map((category) => {
        const isVisible = visibility[category];
        return (
          <button
            key={category}
            onClick={() => onChange(category)}
            className={`group inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-all duration-200 tap-target ${
              isVisible
                ? "bg-muted-bg text-foreground"
                : "text-muted hover:text-foreground/70"
            }`}
            aria-pressed={isVisible}
            title={`Toggle ${PARENTBENCH_CATEGORY_META[category].label}`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full transition-all duration-200 ${CATEGORY_COLORS[category]} ${
                isVisible ? "opacity-100 scale-100" : "opacity-30 scale-75"
              }`}
            />
            <span className={`transition-opacity duration-200 ${
              isVisible ? "opacity-100" : "opacity-50"
            }`}>
              {CATEGORY_SHORT_LABELS[category]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { CATEGORY_COLORS, CATEGORY_SHORT_LABELS };
