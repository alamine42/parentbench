"use client";

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
  return (
    <div
      className={`relative rounded-xl border bg-card-bg p-4 ${
        isOverallBest
          ? "border-green-500 dark:border-green-400"
          : "border-card-border"
      } ${className}`}
    >
      {/* Best badge */}
      {isOverallBest && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-green-500 px-2 py-0.5 text-xs font-semibold text-white dark:bg-green-400 dark:text-green-900">
          Best Overall
        </div>
      )}

      {/* Remove button */}
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-muted transition-colors hover:bg-muted-bg hover:text-foreground"
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

      {/* Model info */}
      <div className="mt-2 flex flex-col items-center text-center">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${provider} logo`}
            className="mb-2 h-10 w-10 rounded-full object-contain"
          />
        ) : (
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted-bg text-lg font-bold">
            {name.charAt(0)}
          </div>
        )}
        <h3 className="text-lg font-semibold">{name}</h3>
        <p className="text-sm text-muted">{provider}</p>
      </div>

      {/* Score */}
      <div className="mt-4 flex flex-col items-center">
        <ScoreRing score={overallScore} size="lg" showGrade />
        <div className="mt-2">
          <LetterGradeBadge grade={overallGrade} size="lg" />
        </div>
      </div>
    </div>
  );
}
