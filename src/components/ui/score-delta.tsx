"use client";

import { useEffect, useState } from "react";

type ScoreDeltaProps = {
  delta: number;
  mode?: "percentage" | "absolute";
  showSign?: boolean;
  size?: "sm" | "md" | "lg";
  animate?: boolean;
  className?: string;
};

const sizeClasses = {
  sm: "text-xs gap-0.5",
  md: "text-sm gap-1",
  lg: "text-base gap-1",
};

const iconSizes = {
  sm: 10,
  md: 12,
  lg: 14,
};

export function ScoreDelta({
  delta,
  mode = "absolute",
  showSign = true,
  size = "md",
  animate = true,
  className = "",
}: ScoreDeltaProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const isPositive = delta > 0;
  const isNegative = delta < 0;
  const isStable = delta === 0;

  // Trigger animation on delta change
  useEffect(() => {
    if (animate && delta !== 0) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 600);
      return () => clearTimeout(timer);
    }
  }, [delta, animate]);

  const colorClass = isPositive
    ? "text-emerald-600 dark:text-emerald-400"
    : isNegative
    ? "text-red-600 dark:text-red-400"
    : "text-muted";

  const bgClass = isPositive
    ? "bg-emerald-50 dark:bg-emerald-900/20"
    : isNegative
    ? "bg-red-50 dark:bg-red-900/20"
    : "bg-muted-bg";

  const formattedValue = mode === "percentage"
    ? `${Math.abs(delta).toFixed(1)}%`
    : Math.abs(delta).toFixed(1);

  const sign = showSign ? (isPositive ? "+" : isNegative ? "−" : "") : "";
  const iconSize = iconSizes[size];

  return (
    <span
      className={`inline-flex items-center font-medium tabular-nums rounded-full px-2 py-0.5 transition-all duration-300 ${colorClass} ${bgClass} ${sizeClasses[size]} ${
        isAnimating ? "scale-110" : "scale-100"
      } ${className}`}
    >
      {/* Arrow icon with animation */}
      <span className={`transition-transform duration-300 ${
        isAnimating && isPositive ? "-translate-y-0.5" : ""
      } ${isAnimating && isNegative ? "translate-y-0.5" : ""}`}>
        {!isStable ? (
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-300 ${isNegative ? "rotate-180" : ""}`}
          >
            <path d="M6 10V2M6 2L2.5 5.5M6 2L9.5 5.5" />
          </svg>
        ) : (
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M2 6h8" />
          </svg>
        )}
      </span>
      <span>
        {sign}
        {formattedValue}
      </span>
    </span>
  );
}

/**
 * Get trend direction from delta
 */
export function deltaToTrend(delta: number): "up" | "down" | "stable" {
  if (delta > 0.5) return "up";
  if (delta < -0.5) return "down";
  return "stable";
}
