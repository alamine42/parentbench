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
import { frrTone } from "@/lib/over-alignment";

type EnrichedScore = ParentBenchResult & {
  modelName: string;
  provider: ModelProvider;
  confidence?: ConfidenceLevel;
  variance?: number | null;
};

type SortField = "model" | "overall" | "false_refusal" | "updated" | ParentBenchCategory;
type SortDir = "asc" | "desc";

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

// Default sort direction for each field. Most metrics are "higher is better"
// (descending); model name is alphabetical (ascending); FRR is "lower is
// better" (ascending). Updated date defaults to most-recent-first.
const DEFAULT_SORT_DIR: Record<SortField, SortDir> = {
  model: "asc",
  overall: "desc",
  false_refusal: "asc",
  updated: "desc",
  age_inappropriate_content: "desc",
  manipulation_resistance: "desc",
  data_privacy_minors: "desc",
  parental_controls_respect: "desc",
};

export function LeaderboardTable({ scores, providers }: LeaderboardTableProps) {
  const [sortBy, setSortBy] = useState<SortField>("overall");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterProvider, setFilterProvider] = useState("all");

  const handleSort = (field: SortField) => {
    if (field === sortBy) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir(DEFAULT_SORT_DIR[field]);
    }
  };

  const handleSelectSort = (field: SortField) => {
    setSortBy(field);
    setSortDir(DEFAULT_SORT_DIR[field]);
  };

  const sortedAndFiltered = useMemo(() => {
    let result = [...scores];

    if (filterProvider !== "all") {
      result = result.filter((s) => s.provider.name === filterProvider);
    }

    // Comparator returns the asc-direction delta (a vs b). We flip the sign
    // for desc at the end so each branch only encodes "how to compare".
    const cmp = (a: EnrichedScore, b: EnrichedScore): number => {
      switch (sortBy) {
        case "model":
          return a.modelName.localeCompare(b.modelName);
        case "overall":
          return a.overallScore - b.overallScore;
        case "false_refusal": {
          // null/undefined sorts last regardless of direction.
          const aFRR = a.falseRefusalRate;
          const bFRR = b.falseRefusalRate;
          const aMissing = aFRR === null || aFRR === undefined;
          const bMissing = bFRR === null || bFRR === undefined;
          if (aMissing && bMissing) return 0;
          if (aMissing) return 1;
          if (bMissing) return -1;
          return aFRR - bFRR;
        }
        case "updated": {
          const aTime = new Date(a.evaluatedDate).getTime();
          const bTime = new Date(b.evaluatedDate).getTime();
          return aTime - bTime;
        }
        default: {
          const aScore = a.categoryScores.find((c) => c.category === sortBy)?.score ?? 0;
          const bScore = b.categoryScores.find((c) => c.category === sortBy)?.score ?? 0;
          return aScore - bScore;
        }
      }
    };

    result.sort((a, b) => {
      const delta = cmp(a, b);
      // For non-model fields, fall back to model name as a stable tiebreaker.
      if (delta === 0 && sortBy !== "model") {
        return a.modelName.localeCompare(b.modelName);
      }
      return sortDir === "desc" ? -delta : delta;
    });

    return result;
  }, [scores, sortBy, sortDir, filterProvider]);

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
            onChange={(e) => handleSelectSort(e.target.value as SortField)}
            className="rounded-lg border border-card-border bg-card-bg px-3 py-2 text-sm text-foreground
                       shadow-sm hover:border-accent/50 transition-colors duration-150
                       focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          >
            <option value="model">Model</option>
            <option value="overall">Safety Score</option>
            <option value="false_refusal">False Refusal</option>
            {CATEGORY_ORDER.map((cat) => (
              <option key={cat} value={cat}>
                {PARENTBENCH_CATEGORY_META[cat].label}
              </option>
            ))}
            <option value="updated">Last Updated</option>
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
              <SortableHeader
                field="model"
                label="Model"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={handleSort}
                align="left"
              />
              <SortableHeader
                field="overall"
                label="Safety"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={handleSort}
                align="center"
                widthClass="w-28"
              />
              <SortableHeader
                field="false_refusal"
                label={<span title="False Refusal Rate — percentage of legitimate kid/parent prompts the model refused">False&nbsp;Refusal</span>}
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={handleSort}
                align="center"
                widthClass="w-24"
              />
              {CATEGORY_ORDER.map((cat) => (
                <SortableHeader
                  key={cat}
                  field={cat}
                  label={CATEGORY_SHORT_LABELS[cat]}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                  align="center"
                  widthClass="w-28"
                  paddingClass="px-3"
                />
              ))}
              <SortableHeader
                field="updated"
                label="Updated"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={handleSort}
                align="center"
                widthClass="w-28"
              />
              <th className="py-4 px-4 text-center text-xs font-semibold text-muted uppercase tracking-wider w-28">
                Report
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
                    <div className="font-semibold text-foreground group-hover/link:text-accent transition-colors duration-150">
                      {score.modelName}
                    </div>
                  </Link>
                </td>

                <td className="py-4 px-4">
                  <div className="flex items-center justify-center gap-2">
                    <ScoreRing score={score.overallScore} size="sm" />
                    <LetterGradeBadge grade={score.overallGrade} size="sm" />
                    {score.confidence && (
                      <ConfidenceDot confidence={score.confidence} variance={score.variance} isPartial={score.isPartial} />
                    )}
                  </div>
                </td>

                <td className="py-4 px-4">
                  <div className="flex items-center justify-center">
                    <FalseRefusalBadge
                      rate={score.falseRefusalRate}
                      refusalCount={score.benignRefusalCount}
                      totalCount={score.benignTotalCount}
                    />
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

                {/* Full report link */}
                <td className="py-4 px-4 text-center">
                  <Link
                    href={`/model/${score.modelSlug}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                  >
                    View
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </Link>
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

type SortableHeaderProps = {
  field: SortField;
  label: React.ReactNode;
  sortBy: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  align: "left" | "center";
  widthClass?: string;
  paddingClass?: string;
};

function SortableHeader({
  field,
  label,
  sortBy,
  sortDir,
  onSort,
  align,
  widthClass = "",
  paddingClass = "px-4",
}: SortableHeaderProps) {
  const isActive = sortBy === field;
  const alignClass = align === "left" ? "text-left" : "text-center";
  const justifyClass = align === "left" ? "justify-start" : "justify-center";
  const ariaSort: "ascending" | "descending" | "none" = isActive
    ? sortDir === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <th
      aria-sort={ariaSort}
      className={`py-4 ${paddingClass} ${alignClass} text-xs font-semibold uppercase tracking-wider ${widthClass}`}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 ${justifyClass} w-full select-none transition-colors duration-150
                    ${isActive ? "text-accent" : "text-muted hover:text-foreground"}
                    focus:outline-none focus:ring-2 focus:ring-accent/30 rounded`}
      >
        <span>{label}</span>
        <SortIndicator active={isActive} dir={sortDir} />
      </button>
    </th>
  );
}

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return (
      <svg
        className="h-3 w-3 opacity-40"
        viewBox="0 0 12 12"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M6 2.5l3 3.5H3l3-3.5zM6 9.5l-3-3.5h6l-3 3.5z" />
      </svg>
    );
  }
  return dir === "asc" ? (
    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M6 2.5l4 5H2l4-5z" />
    </svg>
  ) : (
    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M6 9.5l-4-5h8l-4 5z" />
    </svg>
  );
}

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
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex flex-col items-end leading-tight">
            <span className="text-[9px] uppercase tracking-wider text-muted">Safety</span>
            <span className="text-base font-semibold tabular-nums">{score.overallScore}</span>
          </div>
          <LetterGradeBadge grade={score.overallGrade} size="sm" />
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

      <div className="border-t border-card-border bg-muted-bg/20 p-4 space-y-4">
        {score.falseRefusalRate !== null && score.falseRefusalRate !== undefined ? (
          <div className="flex items-center justify-between pb-3 border-b border-card-border/50">
            <span className="text-sm font-medium text-muted">False Refusal Rate</span>
            <div className="flex items-center gap-2">
              <FalseRefusalBadge
                rate={score.falseRefusalRate}
                refusalCount={score.benignRefusalCount}
                totalCount={score.benignTotalCount}
              />
              {score.benignRefusalCount !== null && score.benignRefusalCount !== undefined &&
               score.benignTotalCount !== null && score.benignTotalCount !== undefined ? (
                <span className="text-xs text-muted tabular-nums">
                  {score.benignRefusalCount} of {score.benignTotalCount}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

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

const FRR_TONE_CLASSES = {
  good: "border-emerald-300/40 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-900/20 dark:text-emerald-200",
  warn: "border-amber-300/40 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-900/20 dark:text-amber-200",
  bad: "border-red-300/40 bg-red-50 text-red-800 dark:border-red-400/30 dark:bg-red-900/20 dark:text-red-200",
} as const;

function FalseRefusalBadge({
  rate,
  refusalCount,
  totalCount,
}: {
  rate: number | null | undefined;
  refusalCount: number | null | undefined;
  totalCount: number | null | undefined;
}) {
  if (rate === null || rate === undefined) {
    return (
      <span
        className="inline-flex h-7 w-9 items-center justify-center rounded-full
                   border border-dashed border-card-border text-sm text-muted"
        title="No benign data yet"
        aria-label="No benign data yet"
      >
        —
      </span>
    );
  }
  const pct = Math.round(rate * 100);
  const tone = FRR_TONE_CLASSES[frrTone(rate * 100)];

  const tooltip =
    refusalCount !== null && refusalCount !== undefined &&
    totalCount !== null && totalCount !== undefined
      ? `${refusalCount} of ${totalCount} benign prompts refused`
      : `${pct}% false refusal rate`;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums ${tone}`}
      title={tooltip}
    >
      {pct}%
    </span>
  );
}
