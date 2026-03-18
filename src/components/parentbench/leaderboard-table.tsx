"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import type { ParentBenchResult, ParentBenchCategory } from "@/types/parentbench";
import type { ModelProvider } from "@/types/model";
import { ScoreRing } from "@/components/ui/score-ring";
import { LetterGradeBadge } from "@/components/ui/letter-grade";
import { ColorBar } from "@/components/ui/color-bar";
import { PARENTBENCH_CATEGORY_META } from "@/lib/constants";

type EnrichedScore = ParentBenchResult & {
  modelName: string;
  provider: ModelProvider;
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
      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="sort" className="text-sm font-medium text-muted">
            Sort by
          </label>
          <select
            id="sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortField)}
            className="rounded-lg border border-card-border bg-card-bg px-3 py-1.5 text-sm text-foreground"
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
          <label htmlFor="provider" className="text-sm font-medium text-muted">
            Provider
          </label>
          <select
            id="provider"
            value={filterProvider}
            onChange={(e) => setFilterProvider(e.target.value)}
            className="rounded-lg border border-card-border bg-card-bg px-3 py-1.5 text-sm text-foreground"
          >
            <option value="all">All Providers</option>
            {providers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full border-collapse" role="table">
          <thead>
            <tr className="border-b border-card-border">
              <th className="py-3 px-2 text-left text-sm font-semibold text-muted w-16">
                Rank
              </th>
              <th className="py-3 px-2 text-left text-sm font-semibold text-muted">
                Model
              </th>
              <th className="py-3 px-2 text-center text-sm font-semibold text-muted w-24">
                Overall
              </th>
              {CATEGORY_ORDER.map((cat) => (
                <th
                  key={cat}
                  className="py-3 px-2 text-center text-sm font-semibold text-muted w-28"
                >
                  {CATEGORY_SHORT_LABELS[cat]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedAndFiltered.map((score, index) => (
              <tr
                key={score.modelSlug}
                className="border-b border-card-border hover:bg-muted-bg/50 transition-colors"
              >
                <td className="py-4 px-2 text-center">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted-bg text-sm font-bold">
                    {index + 1}
                  </span>
                </td>
                <td className="py-4 px-2">
                  <Link
                    href={`/model/${score.modelSlug}`}
                    className="flex items-center gap-3 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    <Image
                      src={score.provider.logo}
                      alt={score.provider.name}
                      width={28}
                      height={28}
                      className="rounded-md"
                    />
                    <div>
                      <div className="font-medium">{score.modelName}</div>
                      <div className="text-sm text-muted">{score.provider.name}</div>
                    </div>
                  </Link>
                </td>
                <td className="py-4 px-2">
                  <div className="flex items-center justify-center gap-2">
                    <ScoreRing score={score.overallScore} size="sm" />
                    <LetterGradeBadge grade={score.overallGrade} size="sm" />
                  </div>
                </td>
                {CATEGORY_ORDER.map((cat) => {
                  const catScore = getCategoryScore(score, cat);
                  return (
                    <td key={cat} className="py-4 px-2">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm font-medium tabular-nums">
                          {catScore}
                        </span>
                        <div className="w-16">
                          <ColorBar score={catScore} height="sm" />
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile/Tablet Cards */}
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

      {/* Empty state */}
      {sortedAndFiltered.length === 0 && (
        <div className="py-12 text-center text-muted">
          No models found matching your filters.
        </div>
      )}
    </div>
  );
}

type MobileCardProps = {
  score: EnrichedScore;
  rank: number;
  getCategoryScore: (score: EnrichedScore, category: ParentBenchCategory) => number;
};

function MobileCard({ score, rank, getCategoryScore }: MobileCardProps) {
  return (
    <details className="group rounded-xl border border-card-border bg-card-bg overflow-hidden">
      <summary className="flex items-center gap-3 p-4 cursor-pointer list-none">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted-bg text-sm font-bold">
          {rank}
        </span>
        <Image
          src={score.provider.logo}
          alt={score.provider.name}
          width={28}
          height={28}
          className="rounded-md shrink-0"
        />
        <div className="flex-1 min-w-0">
          <Link
            href={`/model/${score.modelSlug}`}
            className="font-medium hover:text-blue-600 dark:hover:text-blue-400 truncate block"
            onClick={(e) => e.stopPropagation()}
          >
            {score.modelName}
          </Link>
          <div className="text-sm text-muted">{score.provider.name}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ScoreRing score={score.overallScore} size="sm" />
          <LetterGradeBadge grade={score.overallGrade} size="sm" />
        </div>
        <svg
          className="h-5 w-5 text-muted transition-transform group-open:rotate-180 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="border-t border-card-border bg-muted-bg/30 p-4 space-y-3">
        {CATEGORY_ORDER.map((cat) => {
          const catScore = getCategoryScore(score, cat);
          return (
            <div key={cat} className="flex items-center gap-3">
              <span className="text-sm text-muted w-28 shrink-0">
                {CATEGORY_SHORT_LABELS[cat]}
              </span>
              <div className="flex-1">
                <ColorBar score={catScore} showValue height="sm" />
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
