type ScoreDeltaProps = {
  delta: number;
  mode?: "percentage" | "absolute";
  showSign?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

export function ScoreDelta({
  delta,
  mode = "absolute",
  showSign = true,
  size = "md",
  className = "",
}: ScoreDeltaProps) {
  const isPositive = delta > 0;
  const isNegative = delta < 0;
  const isStable = delta === 0;

  const colorClass = isPositive
    ? "text-green-600 dark:text-green-400"
    : isNegative
    ? "text-red-600 dark:text-red-400"
    : "text-muted";

  const formattedValue = mode === "percentage"
    ? `${Math.abs(delta).toFixed(1)}%`
    : Math.abs(delta).toFixed(1);

  const sign = showSign ? (isPositive ? "+" : isNegative ? "-" : "") : "";

  return (
    <span
      className={`inline-flex items-center gap-0.5 font-medium tabular-nums ${colorClass} ${sizeClasses[size]} ${className}`}
    >
      {!isStable && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={isNegative ? "rotate-180" : ""}
        >
          <path d="M6 10V2M6 2L2 6M6 2L10 6" />
        </svg>
      )}
      {isStable && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M2 6h8" />
        </svg>
      )}
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
