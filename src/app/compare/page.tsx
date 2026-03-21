import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getAllModels } from "@/db/queries/models";
import { ModelComparisonView } from "@/components/comparison";

export const metadata: Metadata = {
  title: "Compare AI Model Safety Scores | ParentBench",
  description:
    "Compare child-safety scores of AI models side-by-side. See how GPT-4, Claude, Gemini, and other LLMs stack up across key safety categories.",
  openGraph: {
    title: "Compare AI Model Safety Scores",
    description: "Side-by-side comparison of AI child safety scores",
    type: "website",
  },
};

// Beautiful skeleton loader with shimmer effect
function ComparisonSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Selector skeleton */}
      <div className="h-12 w-full max-w-md rounded-xl skeleton-shimmer" />

      {/* Instructions skeleton */}
      <div className="flex items-center gap-4 py-6">
        <div className="h-16 w-16 rounded-xl skeleton-shimmer" />
        <div className="space-y-2">
          <div className="h-5 w-48 rounded skeleton-shimmer" />
          <div className="h-4 w-72 rounded skeleton-shimmer" />
        </div>
      </div>

      {/* Cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-64 rounded-2xl border border-card-border overflow-hidden"
          >
            <div className="h-full skeleton-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function ComparisonContent() {
  const models = await getAllModels();

  // Transform for the selector
  const selectorModels = models.map((m) => ({
    id: m.id,
    slug: m.slug,
    name: m.name,
    provider: {
      id: m.provider.id,
      name: m.provider.name,
      slug: m.provider.slug,
      logoUrl: m.provider.logoUrl,
    },
  }));

  return <ModelComparisonView availableModels={selectorModels} />;
}

export default function ComparePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:text-foreground transition-colors">
                Home
              </Link>
            </li>
            <li className="text-card-border">/</li>
            <li className="text-foreground font-medium">Compare Models</li>
          </ol>
        </nav>

        {/* Header */}
        <header className="mb-8 sm:mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Compare AI Models
          </h1>
          <p className="mt-3 text-muted max-w-2xl text-base sm:text-lg">
            Select up to 4 models to compare their child-safety scores side-by-side
            across all evaluation categories.
          </p>

          {/* Quick stats hint */}
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted">
            <div className="flex items-center gap-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-emerald-500"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Best-in-category highlighting</span>
            </div>
            <div className="flex items-center gap-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-blue-500"
              >
                <path d="M18 20V10M12 20V4M6 20v-6" />
              </svg>
              <span>Category-level breakdown</span>
            </div>
            <div className="flex items-center gap-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-purple-500"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <span>Shareable comparison links</span>
            </div>
          </div>
        </header>

        {/* Comparison View */}
        <Suspense fallback={<ComparisonSkeleton />}>
          <ComparisonContent />
        </Suspense>
      </div>
    </div>
  );
}
