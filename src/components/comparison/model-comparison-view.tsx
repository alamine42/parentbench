"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { ParentBenchCategory } from "@/types/parentbench";
import type { LetterGrade } from "@/types/model";
import { PARENTBENCH_CATEGORY_ORDER } from "@/lib/constants";
import { ModelSelector } from "./model-selector";
import { ComparisonCard } from "./comparison-card";
import { CategoryComparisonBar } from "./category-comparison-bar";
import { ModelChip } from "@/components/ui/model-chip";
import { EmptyState } from "@/components/ui/empty-state";

type Model = {
  id: string;
  slug: string;
  name: string;
  provider: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
  };
};

type ModelWithScore = Model & {
  latestScore: {
    overallScore: number;
    overallGrade: string;
    trend: string;
    dataQuality: string;
    computedAt: string;
    categoryScores: Array<{
      category: string;
      score: number;
      grade: string;
      passRate: number;
      testCount: number;
    }>;
  } | null;
  isOverallBest: boolean;
};

type CategoryComparison = Record<
  string,
  Array<{
    modelSlug: string;
    score: number;
    grade: string;
    passRate: number;
    isBest: boolean;
  }>
>;

type ComparisonData = {
  models: ModelWithScore[];
  categoryComparison: CategoryComparison;
};

type ModelComparisonViewProps = {
  availableModels: Model[];
  initialSlugs?: string[];
  className?: string;
};

// Skeleton for loading state
function ComparisonLoadingSkeleton() {
  return (
    <div className="animate-in fade-in duration-300">
      {/* Cards skeleton */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-64 rounded-2xl border border-card-border overflow-hidden"
          >
            <div className="h-full skeleton-shimmer" />
          </div>
        ))}
      </div>

      {/* Category bars skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-48 rounded skeleton-shimmer" />
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-32 rounded-xl border border-card-border overflow-hidden"
          >
            <div className="h-full skeleton-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ModelComparisonView({
  availableModels,
  initialSlugs = [],
  className = "",
}: ModelComparisonViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse selected models from URL
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(() => {
    const urlModels = searchParams.get("models");
    if (urlModels) {
      return urlModels.split(",").filter(Boolean);
    }
    return initialSlugs;
  });

  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync URL changes back to state (for browser back/forward, shared links)
  useEffect(() => {
    const urlModels = searchParams.get("models");

    // Only sync if URL explicitly has models param - preserve initialSlugs otherwise
    if (urlModels === null) {
      return;
    }

    const urlSlugs = urlModels.split(",").filter(Boolean);

    // Compare arrays to avoid unnecessary updates
    const isEqual =
      urlSlugs.length === selectedSlugs.length &&
      urlSlugs.every((slug, i) => slug === selectedSlugs[i]);

    if (!isEqual) {
      setSelectedSlugs(urlSlugs);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update URL when selection changes
  const updateUrl = useCallback(
    (slugs: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (slugs.length > 0) {
        params.set("models", slugs.join(","));
      } else {
        params.delete("models");
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  // Add a model
  const handleAddModel = useCallback(
    (slug: string) => {
      const newSlugs = [...selectedSlugs, slug];
      setSelectedSlugs(newSlugs);
      updateUrl(newSlugs);
    },
    [selectedSlugs, updateUrl]
  );

  // Remove a model
  const handleRemoveModel = useCallback(
    (slug: string) => {
      const newSlugs = selectedSlugs.filter((s) => s !== slug);
      setSelectedSlugs(newSlugs);
      updateUrl(newSlugs);
    },
    [selectedSlugs, updateUrl]
  );

  // Fetch comparison data when selection changes
  useEffect(() => {
    async function fetchComparison() {
      if (selectedSlugs.length < 2) {
        setComparisonData(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/internal/scores/compare?models=${selectedSlugs.join(",")}`
        );
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to fetch comparison data");
        }

        setComparisonData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        setComparisonData(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchComparison();
  }, [selectedSlugs]);

  // Get model name by slug for chips
  const getModelName = (slug: string) => {
    return availableModels.find((m) => m.slug === slug)?.name || slug;
  };

  return (
    <div className={className}>
      {/* Model Selector */}
      <div className="mb-6">
        <ModelSelector
          models={availableModels}
          selectedSlugs={selectedSlugs}
          onSelect={handleAddModel}
          maxSelections={4}
          className="max-w-lg"
        />
      </div>

      {/* Selected Models Chips */}
      {selectedSlugs.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {selectedSlugs.map((slug) => {
            const model = availableModels.find((m) => m.slug === slug);
            return (
              <ModelChip
                key={slug}
                name={model?.name || slug}
                provider={model?.provider.name}
                logoUrl={model?.provider.logoUrl}
                onRemove={() => handleRemoveModel(slug)}
              />
            );
          })}

          {/* Clear all button */}
          {selectedSlugs.length > 1 && (
            <button
              onClick={() => {
                setSelectedSlugs([]);
                updateUrl([]);
              }}
              className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors px-2"
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
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading && <ComparisonLoadingSkeleton />}

      {/* Error State */}
      {!isLoading && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800/50 dark:bg-red-900/20">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="mx-auto mb-3 text-red-500"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <p className="text-red-700 dark:text-red-400 font-medium">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setSelectedSlugs([...selectedSlugs]); // Trigger refetch
            }}
            className="mt-4 rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && selectedSlugs.length < 2 && (
        <EmptyState
          variant="no-comparison"
          title={selectedSlugs.length === 1 ? "Add one more model" : "Compare AI models"}
          description={
            selectedSlugs.length === 1
              ? `Add another model to compare with ${getModelName(selectedSlugs[0])}`
              : "Select 2-4 models above to see a detailed side-by-side comparison of their safety scores across all categories."
          }
        />
      )}

      {/* Comparison Results */}
      {!isLoading && !error && comparisonData && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Model Cards Grid */}
          <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {comparisonData.models.map((model) => (
              <ComparisonCard
                key={model.slug}
                name={model.name}
                provider={model.provider.name}
                logoUrl={model.provider.logoUrl}
                overallScore={model.latestScore?.overallScore ?? 0}
                overallGrade={(model.latestScore?.overallGrade ?? "F") as LetterGrade}
                isOverallBest={model.isOverallBest}
                onRemove={() => handleRemoveModel(model.slug)}
              />
            ))}
          </div>

          {/* Category Comparison */}
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
                Category Breakdown
              </h2>
              <span className="text-sm text-muted">
                {PARENTBENCH_CATEGORY_ORDER.length} categories
              </span>
            </div>
            <div className="space-y-4">
              {PARENTBENCH_CATEGORY_ORDER.map((category) => {
                const categoryData = comparisonData.categoryComparison[category];
                if (!categoryData) return null;

                // Map slugs to names
                const dataWithNames = categoryData.map((d) => ({
                  ...d,
                  modelName: getModelName(d.modelSlug),
                }));

                return (
                  <CategoryComparisonBar
                    key={category}
                    category={category}
                    data={dataWithNames}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
