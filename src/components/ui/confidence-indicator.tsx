"use client";

import { useState, useRef, useEffect, useId, type ReactNode } from "react";
import type { ConfidenceLevel } from "@/types/parentbench";

// ============================================================================
// TYPES
// ============================================================================

type ConfidenceIndicatorProps = {
  confidence: ConfidenceLevel;
  variance?: number | null;
  isPartial?: boolean;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
};

type TooltipPosition = "top" | "bottom";

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIDENCE_CONFIG: Record<
  Exclude<ConfidenceLevel, null>,
  {
    dotColor: string;
    ringColor: string;
    textColor: string;
    bgColor: string;
    glowColor: string;
    label: string;
    shortLabel: string;
    description: string;
    icon: ReactNode;
  }
> = {
  high: {
    dotColor: "bg-emerald-500",
    ringColor: "ring-emerald-500/30",
    textColor: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
    glowColor: "shadow-emerald-500/25",
    label: "High Confidence",
    shortLabel: "High",
    description: "Highly consistent results across multiple evaluation runs",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  medium: {
    dotColor: "bg-amber-500",
    ringColor: "ring-amber-500/30",
    textColor: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/40",
    glowColor: "shadow-amber-500/25",
    label: "Medium Confidence",
    shortLabel: "Medium",
    description: "Some variability observed between evaluation runs",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    ),
  },
  low: {
    dotColor: "bg-rose-500",
    ringColor: "ring-rose-500/30",
    textColor: "text-rose-600 dark:text-rose-400",
    bgColor: "bg-rose-50 dark:bg-rose-950/40",
    glowColor: "shadow-rose-500/25",
    label: "Low Confidence",
    shortLabel: "Low",
    description: "Significant variability between evaluation runs",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
  legacy: {
    dotColor: "bg-slate-400 dark:bg-slate-500",
    ringColor: "ring-slate-400/30 dark:ring-slate-500/30",
    textColor: "text-slate-500 dark:text-slate-400",
    bgColor: "bg-slate-100 dark:bg-slate-800/40",
    glowColor: "shadow-slate-400/20",
    label: "Legacy Score",
    shortLabel: "Legacy",
    description: "Single-run evaluation from before our multi-run system",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

const SIZE_CONFIG = {
  sm: {
    dot: "h-2 w-2",
    ring: "h-4 w-4",
    text: "text-[10px]",
    padding: "px-1.5 py-0.5",
    gap: "gap-1",
  },
  md: {
    dot: "h-2.5 w-2.5",
    ring: "h-5 w-5",
    text: "text-xs",
    padding: "px-2 py-1",
    gap: "gap-1.5",
  },
  lg: {
    dot: "h-3 w-3",
    ring: "h-6 w-6",
    text: "text-sm",
    padding: "px-2.5 py-1",
    gap: "gap-2",
  },
};

// ============================================================================
// TOOLTIP COMPONENT (Stripe-style floating tooltip)
// ============================================================================

function ConfidenceTooltip({
  id,
  confidence,
  variance,
  isPartial,
  isVisible,
  position,
  triggerRef,
}: {
  id: string;
  confidence: Exclude<ConfidenceLevel, null>;
  variance?: number | null;
  isPartial?: boolean;
  isVisible: boolean;
  position: TooltipPosition;
  triggerRef: React.RefObject<HTMLElement>;
}) {
  const config = CONFIDENCE_CONFIG[confidence];
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      let x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
      const y = position === "top"
        ? triggerRect.top - tooltipRect.height - 8
        : triggerRect.bottom + 8;

      // Keep tooltip within viewport
      const padding = 12;
      if (x < padding) x = padding;
      if (x + tooltipRect.width > window.innerWidth - padding) {
        x = window.innerWidth - tooltipRect.width - padding;
      }

      setCoords({ x, y });
    }
  }, [isVisible, position, triggerRef]);

  if (!isVisible) return null;

  return (
    <div
      id={id}
      ref={tooltipRef}
      role="tooltip"
      className={`
        fixed z-50 w-64 rounded-xl border border-card-border bg-card-bg p-3
        shadow-lg shadow-black/5 dark:shadow-black/20
        transform transition-all duration-200 ease-out
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 pointer-events-none"}
      `}
      style={{
        left: coords.x,
        top: coords.y,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`flex items-center justify-center rounded-full ${config.bgColor} ${config.textColor} p-1`}>
          {config.icon}
        </span>
        <span className={`font-semibold ${config.textColor}`}>{config.label}</span>
      </div>

      {/* Description */}
      <p className="text-sm text-muted leading-relaxed mb-2">
        {config.description}
      </p>

      {/* Variance stat */}
      {variance !== null && variance !== undefined && confidence !== "legacy" && (
        <div className="flex items-center justify-between py-2 px-2.5 rounded-lg bg-muted-bg/60">
          <span className="text-xs text-muted">Score Variance</span>
          <span className="text-sm font-semibold tabular-nums">
            ±{variance.toFixed(1)} pts
          </span>
        </div>
      )}

      {/* Partial badge */}
      {isPartial && (
        <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600 dark:text-amber-400">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span>Partial evaluation (some runs failed)</span>
        </div>
      )}

      {/* Arrow */}
      <div
        className={`
          absolute w-3 h-3 bg-card-bg border-card-border rotate-45
          ${position === "top"
            ? "bottom-[-7px] border-r border-b"
            : "top-[-7px] border-l border-t"}
        `}
        style={{ left: "calc(50% - 6px)" }}
      />
    </div>
  );
}

// ============================================================================
// MAIN CONFIDENCE INDICATOR
// ============================================================================

export function ConfidenceIndicator({
  confidence,
  variance,
  isPartial,
  showLabel = false,
  size = "md",
}: ConfidenceIndicatorProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>("top");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();

  if (!confidence) return null;

  const config = CONFIDENCE_CONFIG[confidence];
  const sizeConfig = SIZE_CONFIG[size];

  const handleMouseEnter = () => {
    setIsHovered(true);
    // Determine tooltip position based on available space
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      setTooltipPosition(spaceAbove < 200 ? "bottom" : "top");
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={handleMouseEnter}
        onBlur={() => setIsHovered(false)}
        className={`
          inline-flex items-center ${sizeConfig.gap} rounded-full ${sizeConfig.padding}
          ${config.bgColor} cursor-help
          transition-all duration-200 ease-out
          hover:ring-2 ${config.ringColor}
          focus-visible:outline-none focus-visible:ring-2 ${config.ringColor}
          active:scale-95
        `}
        aria-label={`${config.label}${variance != null && confidence !== "legacy" ? ` - variance ${variance.toFixed(1)} points` : ""}`}
        aria-describedby={isHovered ? tooltipId : undefined}
      >
        {/* Animated dot with pulse effect for high confidence */}
        <span className="relative flex items-center justify-center">
          <span
            className={`
              ${sizeConfig.dot} rounded-full ${config.dotColor}
              transition-transform duration-200 ease-out
              ${isHovered ? "scale-110" : "scale-100"}
            `}
          />
          {confidence === "high" && (
            <span
              className={`
                absolute inset-0 rounded-full ${config.dotColor}
                animate-ping opacity-40
              `}
              style={{ animationDuration: "2s" }}
            />
          )}
        </span>

        {showLabel && (
          <span className={`${sizeConfig.text} font-medium ${config.textColor} whitespace-nowrap`}>
            {config.shortLabel}
          </span>
        )}
      </button>

      <ConfidenceTooltip
        id={tooltipId}
        confidence={confidence}
        variance={variance}
        isPartial={isPartial}
        isVisible={isHovered}
        position={tooltipPosition}
        triggerRef={triggerRef as React.RefObject<HTMLElement>}
      />
    </>
  );
}

// ============================================================================
// COMPACT DOT FOR TABLES (Desktop-optimized)
// ============================================================================

export function ConfidenceDot({
  confidence,
  variance,
  isPartial,
}: {
  confidence: ConfidenceLevel;
  variance?: number | null;
  isPartial?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>("top");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();

  if (!confidence) return null;

  const config = CONFIDENCE_CONFIG[confidence];

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setTooltipPosition(rect.top < 200 ? "bottom" : "top");
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={handleMouseEnter}
        onBlur={() => setIsHovered(false)}
        className={`
          relative inline-flex items-center justify-center
          h-5 w-5 rounded-full cursor-help
          transition-all duration-200 ease-out
          hover:scale-110 hover:shadow-md ${config.glowColor}
          focus-visible:outline-none focus-visible:ring-2 ${config.ringColor} focus-visible:ring-offset-2
          active:scale-95
        `}
        aria-label={`${config.label}${variance != null && confidence !== "legacy" ? ` - variance ${variance.toFixed(1)} points` : ""}`}
        aria-describedby={isHovered ? tooltipId : undefined}
      >
        {/* Subtle background ring */}
        <span className={`absolute inset-0 rounded-full ${config.bgColor} opacity-60`} />

        {/* Main dot */}
        <span
          className={`
            relative h-2 w-2 rounded-full ${config.dotColor}
            transition-transform duration-200 ease-out
            ${isHovered ? "scale-125" : "scale-100"}
          `}
        />

        {/* Pulse animation for high confidence */}
        {confidence === "high" && (
          <span
            className={`
              absolute h-2 w-2 rounded-full ${config.dotColor}
              animate-ping opacity-30
            `}
            style={{ animationDuration: "2.5s" }}
          />
        )}
      </button>

      <ConfidenceTooltip
        id={tooltipId}
        confidence={confidence}
        variance={variance}
        isPartial={isPartial}
        isVisible={isHovered}
        position={tooltipPosition}
        triggerRef={triggerRef as React.RefObject<HTMLElement>}
      />
    </>
  );
}

// ============================================================================
// MOBILE-OPTIMIZED BADGE (Touch-friendly with tap to reveal)
// ============================================================================

export function ConfidenceBadgeMobile({
  confidence,
  variance,
  isPartial,
}: {
  confidence: ConfidenceLevel;
  variance?: number | null;
  isPartial?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!confidence) return null;

  const config = CONFIDENCE_CONFIG[confidence];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`
          inline-flex items-center gap-1.5 rounded-full px-2.5 py-1
          ${config.bgColor} ${config.textColor}
          transition-all duration-200 ease-out
          active:scale-95 touch-manipulation
          ${isExpanded ? `ring-2 ${config.ringColor}` : ""}
        `}
        aria-expanded={isExpanded}
        aria-label={`${config.label}, tap for details`}
      >
        {/* Icon */}
        <span className="flex items-center justify-center">
          {config.icon}
        </span>

        {/* Label */}
        <span className="text-xs font-semibold">
          {config.shortLabel}
        </span>

        {/* Expand indicator */}
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable detail panel (mobile-optimized) */}
      <div
        className={`
          absolute right-0 top-full mt-2 z-30
          w-72 rounded-xl border border-card-border bg-card-bg p-3
          shadow-xl shadow-black/10 dark:shadow-black/30
          transform transition-all duration-200 ease-out origin-top-right
          ${isExpanded
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 -translate-y-2 pointer-events-none"}
        `}
      >
        <div className="flex items-start gap-2.5 mb-2">
          <span className={`flex items-center justify-center rounded-lg ${config.bgColor} ${config.textColor} p-1.5`}>
            {config.icon}
          </span>
          <div>
            <div className={`font-semibold ${config.textColor}`}>{config.label}</div>
            <p className="text-xs text-muted mt-0.5">{config.description}</p>
          </div>
        </div>

        {variance !== null && variance !== undefined && confidence !== "legacy" && (
          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted-bg/60 mt-2">
            <span className="text-xs text-muted">Score Variance</span>
            <span className="text-sm font-bold tabular-nums">±{variance.toFixed(1)}</span>
          </div>
        )}

        {isPartial && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600 dark:text-amber-400 px-1">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span>Partial evaluation</span>
          </div>
        )}
      </div>

      {/* Backdrop for mobile (click outside to close) */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setIsExpanded(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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

/**
 * Get confidence level from variance value
 */
export function getConfidenceFromVariance(variance: number | null | undefined): Exclude<ConfidenceLevel, "legacy"> | null {
  if (variance === null || variance === undefined) return null;
  if (variance < 5) return "high";
  if (variance <= 15) return "medium";
  return "low";
}
