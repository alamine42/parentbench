"use client";

export type TimeRange = "1M" | "3M" | "6M" | "1Y" | "ALL";

type TimeRangeSelectorProps = {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  className?: string;
};

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "6M", label: "6M" },
  { value: "1Y", label: "1Y" },
  { value: "ALL", label: "All" },
];

export function TimeRangeSelector({
  value,
  onChange,
  className = "",
}: TimeRangeSelectorProps) {
  return (
    <div
      className={`inline-flex rounded-lg border border-card-border bg-card-bg p-1 ${className}`}
      role="group"
      aria-label="Select time range"
    >
      {TIME_RANGES.map((range) => (
        <button
          key={range.value}
          onClick={() => onChange(range.value)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            value === range.value
              ? "bg-foreground text-background"
              : "text-muted hover:text-foreground hover:bg-muted-bg"
          }`}
          aria-pressed={value === range.value}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Convert a time range to a Date representing the start of that range
 */
export function timeRangeToDate(range: TimeRange): Date | null {
  const now = new Date();
  switch (range) {
    case "1M":
      return new Date(now.setMonth(now.getMonth() - 1));
    case "3M":
      return new Date(now.setMonth(now.getMonth() - 3));
    case "6M":
      return new Date(now.setMonth(now.getMonth() - 6));
    case "1Y":
      return new Date(now.setFullYear(now.getFullYear() - 1));
    case "ALL":
      return null;
  }
}
