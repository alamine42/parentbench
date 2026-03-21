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
          className="max-w-md"
        />
      </div>

      {/* Selected Models Chips */}
      {selectedSlugs.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
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
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-center text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && selectedSlugs.length < 2 && (
        <EmptyState
          variant="no-comparison"
          description={
            selectedSlugs.length === 1
              ? "Add one more model to start comparing"
              : undefined
          }
        />
      )}

      {/* Comparison Results */}
      {!isLoading && !error && comparisonData && (
        <>
          {/* Model Cards Grid */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <h2 className="mb-4 text-xl font-semibold">Category Breakdown</h2>
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
        </>
      )}
    </div>
  );
}
