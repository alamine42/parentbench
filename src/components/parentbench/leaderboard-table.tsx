"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import type { ParentBenchResult, ParentBenchCategory, ConfidenceLevel } from "@/types/parentbench";
import type { ModelProvider } from "@/types/model";
import { ScoreRing } from "@/components/ui/score-ring";
import { LetterGradeBadge } from "@/components/ui/letter-grade";
import { ColorBar } from "@/components/ui/color-bar";
import { ConfidenceDot, ConfidenceBadgeMobile } from "@/components/ui/confidence-indicator";
import { PARENTBENCH_CATEGORY_META } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

type EnrichedScore = ParentBenchResult & {
  modelName: string;
  provider: ModelProvider;
  confidence?: ConfidenceLevel;
  variance?: number | null;
};

type SortField = "overall" | ParentBenchCategory;

type LeaderboardTableProps = {
  scores: EnrichedScore[];
  providers: string[];
};

const CATEGORY_ORDER: ParentBenchCategory[] = [
  "age_inappropriate_content",
  "manipulation_resistance",
  "data_privacy_minors",
  "parental_controls_respect",
];

const CATEGORY_SHORT_LABELS: Record<ParentBenchCategory, string> = {
  age_inappropriate_content: "Age Content",
  manipulation_resistance: "Manipulation",
  data_privacy_minors: "Privacy",
  parental_controls_respect: "Parental Ctrl",
};

export function LeaderboardTable({ scores, providers }: LeaderboardTableProps) {
  const [sortBy, setSortBy] = useState<SortField>("overall");
  const [filterProvider, setFilterProvider] = useState("all");

  const sortedAndFiltered = useMemo(() => {
    let result = [...scores];

    // Filter by provider
    if (filterProvider !== "all") {
      result = result.filter((s) => s.provider.name === filterProvider);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "overall") {
        return b.overallScore - a.overallScore;
      }
      const aScore = a.categoryScores.find((c) => c.category === sortBy)?.score ?? 0;
      const bScore = b.categoryScores.find((c) => c.category === sortBy)?.score ?? 0;
      return bScore - aScore;
    });

    return result;
  }, [scores, sortBy, filterProvider]);

  const getCategoryScore = (score: EnrichedScore, category: ParentBenchCategory) => {
    return score.categoryScores.find((c) => c.category === category)?.score ?? 0;
  };

  return (
    <div>
      {/* Controls - Polished filter bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="sort" className="text-sm font-medium text-muted whitespace-nowrap">
            Sort by
          </label>
          <select
            id="sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortField)}
            className="rounded-lg border border-card-border bg-card-bg px-3 py-2 text-sm text-foreground
                       shadow-sm hover:border-accent/50 transition-colors duration-150
                       focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          >
            <option value="overall">Overall Score</option>
            {CATEGORY_ORDER.map((cat) => (
              <option key={cat} value={cat}>
                {PARENTBENCH_CATEGORY_META[cat].label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="provider" className="text-sm font-medium text-muted whitespace-nowrap">
            Provider
          </label>
          <select
            id="provider"
            value={filterProvider}
            onChange={(e) => setFilterProvider(e.target.value)}
            className="rounded-lg border border-card-border bg-card-bg px-3 py-2 text-sm text-foreground
                       shadow-sm hover:border-accent/50 transition-colors duration-150
                       focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          >
            <option value="all">All Providers</option>
            {providers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* Results count badge */}
        <div className="ml-auto hidden sm:block">
          <span className="inline-flex items-center rounded-full bg-muted-bg px-3 py-1 text-xs font-medium text-muted">
            {sortedAndFiltered.length} model{sortedAndFiltered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Desktop Table - Enhanced with better spacing and hover states */}
      <div className="hidden lg:block overflow-x-auto rounded-xl border border-card-border bg-card-bg shadow-sm">
        <table className="w-full border-collapse" role="table">
          <thead>
            <tr className="border-b border-card-border bg-muted-bg/30">
              <th className="py-4 px-4 text-left text-xs font-semibold text-muted uppercase tracking-wider w-16">
                Rank
              </th>
              <th className="py-4 px-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                Model
              </th>
              <th className="py-4 px-4 text-center text-xs font-semibold text-muted uppercase tracking-wider w-32">
                <span className="flex items-center justify-center gap-1.5">
                  Score
                  <span
                    className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-muted-bg text-[10px] font-normal cursor-help"
                    title="Confidence indicator shows score reliability across multiple evaluation runs"
                  >
                    ?
                  </span>
                </span>
              </th>
              {CATEGORY_ORDER.map((cat) => (
                <th
                  key={cat}
                  className="py-4 px-3 text-center text-xs font-semibold text-muted uppercase tracking-wider w-28"
                >
                  {CATEGORY_SHORT_LABELS[cat]}
                </th>
              ))}
              <th className="py-4 px-4 text-center text-xs font-semibold text-muted uppercase tracking-wider w-28">
                Updated
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border">
            {sortedAndFiltered.map((score, index) => (
              <tr
                key={score.modelSlug}
                className="group hover:bg-muted-bg/40 transition-colors duration-150"
              >
                {/* Rank */}
                <td className="py-4 px-4">
                  <span className={`
                    inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold
                    transition-all duration-200
                    ${index === 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ring-2 ring-amber-200 dark:ring-amber-700" :
                      index === 1 ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" :
                      index === 2 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                      "bg-muted-bg text-muted"}
                  `}>
                    {index + 1}
                  </span>
                </td>

                {/* Model info */}
                <td className="py-4 px-4">
                  <Link
                    href={`/model/${score.modelSlug}`}
                    className="flex items-center gap-3 group/link"
                  >
                    <div className="relative">
                      <Image
                        src={score.provider.logo}
                        alt={score.provider.name}
                        width={32}
                        height={32}
                        className="rounded-lg ring-1 ring-card-border group-hover/link:ring-accent/30 transition-all duration-200"
                      />
                    </div>
                    <div>
                      <div className="font-semibold text-foreground group-hover/link:text-accent transition-colors duration-150">
                        {score.modelName}
                      </div>
                      <div className="text-sm text-muted">{score.provider.name}</div>
                    </div>
                  </Link>
                </td>

                {/* Score with confidence */}
                <td className="py-4 px-4">
                  <div className="flex items-center justify-center gap-2.5">
                    <ScoreRing score={score.overallScore} size="sm" />
                    <LetterGradeBadge grade={score.overallGrade} size="sm" />
                    {score.confidence && (
                      <ConfidenceDot confidence={score.confidence} variance={score.variance} />
                    )}
                  </div>
                </td>

                {/* Category scores */}
                {CATEGORY_ORDER.map((cat) => {
                  const catScore = getCategoryScore(score, cat);
                  return (
                    <td key={cat} className="py-4 px-3">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {catScore}
                        </span>
                        <div className="w-16">
                          <ColorBar score={catScore} height="sm" />
                        </div>
                      </div>
                    </td>
                  );
                })}

                {/* Last updated */}
                <td className="py-4 px-4 text-center">
                  <span className="text-sm text-muted tabular-nums">
                    {formatDate(score.evaluatedDate)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile/Tablet Cards - Enhanced with better touch targets and visual hierarchy */}
      <div className="lg:hidden space-y-3">
        {sortedAndFiltered.map((score, index) => (
          <MobileCard
            key={score.modelSlug}
            score={score}
            rank={index + 1}
            getCategoryScore={getCategoryScore}
          />
        ))}
      </div>

      {/* Empty state - Polished */}
      {sortedAndFiltered.length === 0 && (
        <div className="py-16 text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-muted-bg mb-4">
            <svg className="h-6 w-6 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <p className="text-muted font-medium">No models found matching your filters.</p>
          <button
            onClick={() => setFilterProvider("all")}
            className="mt-3 text-sm text-accent hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MOBILE CARD COMPONENT - Touch-optimized with gestures
// ============================================================================

type MobileCardProps = {
  score: EnrichedScore;
  rank: number;
  getCategoryScore: (score: EnrichedScore, category: ParentBenchCategory) => number;
};

function MobileCard({ score, rank, getCategoryScore }: MobileCardProps) {
  return (
    <details className="group rounded-2xl border border-card-border bg-card-bg overflow-hidden shadow-sm">
      <summary className="flex items-center gap-3 p-4 cursor-pointer list-none select-none touch-manipulation active:bg-muted-bg/50 transition-colors">
        {/* Rank badge */}
        <span className={`
          flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold
          ${rank === 1 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
            rank === 2 ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" :
            rank === 3 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
            "bg-muted-bg text-muted"}
        `}>
          {rank}
        </span>

        {/* Provider logo */}
        <Image
          src={score.provider.logo}
          alt={score.provider.name}
          width={32}
          height={32}
          className="rounded-lg shrink-0 ring-1 ring-card-border"
        />

        {/* Model info */}
        <div className="flex-1 min-w-0">
          <Link
            href={`/model/${score.modelSlug}`}
            className="font-semibold text-foreground hover:text-accent truncate block transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {score.modelName}
          </Link>
          <div className="text-sm text-muted truncate">{score.provider.name}</div>
        </div>

        {/* Score cluster */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex flex-col items-end">
            <span className="text-lg font-bold tabular-nums">{score.overallScore}</span>
            <LetterGradeBadge grade={score.overallGrade} size="sm" />
          </div>
        </div>

        {/* Expand chevron */}
        <svg
          className="h-5 w-5 text-muted transition-transform duration-200 group-open:rotate-180 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>

      {/* Expanded content */}
      <div className="border-t border-card-border bg-muted-bg/20 p-4 space-y-4">
        {/* Confidence badge (mobile-optimized tap target) */}
        {score.confidence && (
          <div className="flex items-center justify-between pb-3 border-b border-card-border/50">
            <span className="text-sm font-medium text-muted">Confidence</span>
            <ConfidenceBadgeMobile
              confidence={score.confidence}
              variance={score.variance}
              isPartial={score.isPartial}
            />
          </div>
        )}

        {/* Category scores with improved layout */}
        <div className="space-y-3">
          {CATEGORY_ORDER.map((cat) => {
            const catScore = getCategoryScore(score, cat);
            return (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-sm text-muted w-28 shrink-0 font-medium">
                  {CATEGORY_SHORT_LABELS[cat]}
                </span>
                <div className="flex-1">
                  <ColorBar score={catScore} showValue height="md" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Last eval with better visual treatment */}
        <div className="flex items-center justify-between pt-3 border-t border-card-border/50">
          <span className="text-sm text-muted font-medium">Last Evaluated</span>
          <span className="text-sm font-semibold tabular-nums">{formatDate(score.evaluatedDate)}</span>
        </div>

        {/* View details CTA */}
        <Link
          href={`/model/${score.modelSlug}`}
          className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl
                     bg-accent text-white font-semibold text-sm
                     hover:bg-accent/90 active:scale-[0.98] transition-all duration-150
                     touch-manipulation"
        >
          View Full Report
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>
    </details>
  );
}
