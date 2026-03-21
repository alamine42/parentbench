"use client";

import { useState } from "react";
import { ScoreRing } from "@/components/ui/score-ring";
import { LetterGradeBadge } from "@/components/ui/letter-grade";
import type { LetterGrade } from "@/types/model";

type ComparisonCardProps = {
  name: string;
  provider: string;
  logoUrl?: string | null;
  overallScore: number;
  overallGrade: LetterGrade;
  isOverallBest?: boolean;
  onRemove?: () => void;
  className?: string;
};

export function ComparisonCard({
  name,
  provider,
  logoUrl,
  overallScore,
  overallGrade,
  isOverallBest = false,
  onRemove,
  className = "",
}: ComparisonCardProps) {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const showFallbackIcon = !logoUrl || imageError;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-card-bg transition-all duration-300 ${
        isOverallBest
          ? "border-emerald-500/50 ring-2 ring-emerald-500/20 dark:border-emerald-400/50 dark:ring-emerald-400/20"
          : "border-card-border hover:border-muted"
      } ${isHovered ? "elevation-3" : "elevation-1"} ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Best badge - positioned above the card */}
      {isOverallBest && (
        <div className="absolute -top-px left-1/2 -translate-x-1/2 z-10">
          <div className="flex items-center gap-1 rounded-b-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-lg dark:from-emerald-400 dark:to-emerald-500 dark:text-emerald-900">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            Best Overall
          </div>
        </div>
      )}

      {/* Remove button */}
      {onRemove && (
        <button
          onClick={onRemove}
          className={`absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full transition-all duration-200 tap-target ${
            isHovered
              ? "bg-red-100 text-red-600 opacity-100 dark:bg-red-900/30 dark:text-red-400"
              : "bg-muted-bg text-muted opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600"
          }`}
          aria-label={`Remove ${name} from comparison`}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M2 2l8 8M10 2l-8 8" />
          </svg>
        </button>
      )}

      {/* Card content */}
      <div className={`p-5 ${isOverallBest ? "pt-6" : "pt-5"}`}>
        {/* Model info */}
        <div className="flex flex-col items-center text-center">
          {/* Logo */}
          <div className={`mb-3 transition-transform duration-300 ${isHovered ? "scale-105" : ""}`}>
            {showFallbackIcon ? (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-muted-bg to-card-border text-xl font-bold text-muted">
                {name.charAt(0)}
              </div>
            ) : (
              <img
                src={logoUrl}
                alt={`${provider} logo`}
                className="h-12 w-12 rounded-full object-contain"
                onError={() => setImageError(true)}
              />
            )}
          </div>

          {/* Name and provider */}
          <h3 className="text-lg font-semibold leading-tight">{name}</h3>
          <p className="mt-0.5 text-sm text-muted">{provider}</p>
        </div>

        {/* Divider */}
        <div className="my-4 h-px bg-gradient-to-r from-transparent via-card-border to-transparent" />

        {/* Score */}
        <div className="flex flex-col items-center">
          <div className={`transition-transform duration-300 ${isHovered ? "scale-105" : ""}`}>
            <ScoreRing score={overallScore} size="lg" showGrade />
          </div>
          <div className="mt-3">
            <LetterGradeBadge grade={overallGrade} size="lg" />
          </div>
        </div>
      </div>

      {/* Subtle gradient overlay on hover */}
      {isOverallBest && (
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />
      )}
    </div>
  );
}
