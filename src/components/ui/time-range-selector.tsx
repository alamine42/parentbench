"use client";

import { useRef, useEffect, useState } from "react";

export type TimeRange = "1M" | "3M" | "6M" | "1Y" | "ALL";

type TimeRangeSelectorProps = {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  className?: string;
};

const TIME_RANGES: { value: TimeRange; label: string; fullLabel: string }[] = [
  { value: "1M", label: "1M", fullLabel: "1 month" },
  { value: "3M", label: "3M", fullLabel: "3 months" },
  { value: "6M", label: "6M", fullLabel: "6 months" },
  { value: "1Y", label: "1Y", fullLabel: "1 year" },
  { value: "ALL", label: "All", fullLabel: "All time" },
];

export function TimeRangeSelector({
  value,
  onChange,
  className = "",
}: TimeRangeSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  // Update sliding indicator position
  useEffect(() => {
    if (!containerRef.current) return;

    const buttons = containerRef.current.querySelectorAll("button");
    const activeIndex = TIME_RANGES.findIndex((r) => r.value === value);
    const activeButton = buttons[activeIndex] as HTMLElement;

    if (activeButton) {
      setIndicatorStyle({
        left: activeButton.offsetLeft,
        width: activeButton.offsetWidth,
      });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex rounded-xl border border-card-border bg-card-bg p-1 elevation-1 ${className}`}
      role="group"
      aria-label="Select time range"
    >
      {/* Sliding indicator */}
      <div
        className="absolute top-1 h-[calc(100%-8px)] rounded-lg bg-foreground transition-all duration-300 ease-out"
        style={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
        }}
        aria-hidden="true"
      />

      {TIME_RANGES.map((range) => {
        const isActive = value === range.value;
        return (
          <button
            key={range.value}
            onClick={() => onChange(range.value)}
            className={`relative z-10 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200 tap-target ${
              isActive
                ? "text-background"
                : "text-muted hover:text-foreground"
            }`}
            aria-pressed={isActive}
            title={range.fullLabel}
          >
            <span className="relative">
              {range.label}
            </span>
          </button>
        );
      })}
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
