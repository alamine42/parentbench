"use client";

import type { ConfidenceLevel } from "@/types/parentbench";

type ConfidenceIndicatorProps = {
  confidence: ConfidenceLevel;
  variance?: number | null;
  isPartial?: boolean;
  showLabel?: boolean;
  size?: "sm" | "md";
};

const CONFIDENCE_CONFIG: Record<
  Exclude<ConfidenceLevel, null>,
  { dotColor: string; textColor: string; bgColor: string; label: string; description: string }
> = {
  high: {
    dotColor: "bg-green-500",
    textColor: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    label: "High",
    description: "Variance < 5 points - highly consistent results",
  },
  medium: {
    dotColor: "bg-yellow-500",
    textColor: "text-yellow-600 dark:text-yellow-500",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    label: "Medium",
    description: "Variance 5-15 points - some variability",
  },
  low: {
    dotColor: "bg-red-500",
    textColor: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    label: "Low",
    description: "Variance > 15 points - significant variability",
  },
  legacy: {
    dotColor: "bg-gray-400",
    textColor: "text-muted",
    bgColor: "bg-muted-bg",
    label: "Legacy",
    description: "Single-run evaluation (pre-multi-run system)",
  },
};

export function ConfidenceIndicator({
  confidence,
  variance,
  isPartial,
  showLabel = false,
  size = "sm",
}: ConfidenceIndicatorProps) {
  if (!confidence) return null;

  const config = CONFIDENCE_CONFIG[confidence];
  const dotSize = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";

  let tooltipText = `${config.label} Confidence: ${config.description}`;
  if (variance !== null && variance !== undefined && confidence !== "legacy") {
    tooltipText += ` (variance: ${variance.toFixed(1)} pts)`;
  }
  if (isPartial) {
    tooltipText += " - Partial evaluation";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ${config.bgColor} cursor-help`}
      title={tooltipText}
      aria-label={`${config.label} confidence score`}
    >
      <span className={`${dotSize} rounded-full ${config.dotColor}`} />
      {showLabel && (
        <span className={`text-xs font-medium ${config.textColor}`}>{config.label}</span>
      )}
    </span>
  );
}

/**
 * Compact confidence dot for use in tables
 */
export function ConfidenceDot({ confidence, variance }: { confidence: ConfidenceLevel; variance?: number | null }) {
  if (!confidence) return null;

  const config = CONFIDENCE_CONFIG[confidence];

  let tooltipText = `${config.label} Confidence`;
  if (variance !== null && variance !== undefined && confidence !== "legacy") {
    tooltipText += ` (variance: ${variance.toFixed(1)} pts)`;
  }

  return (
    <span
      className={`inline-block ${config.dotColor} h-2 w-2 rounded-full cursor-help`}
      title={tooltipText}
      aria-label={`${config.label} confidence`}
    />
  );
}

/**
 * Get display text for legacy scores
 */
export function getLegacyScoreDisplayText(field: "confidence" | "variance"): string {
  switch (field) {
    case "confidence":
      return "—";
    case "variance":
      return "Single-run score (legacy)";
    default:
      return "";
  }
}
