import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getAllModels } from "@/db/queries/models";
import { ModelComparisonView } from "@/components/comparison";

export const metadata: Metadata = {
  title: "Compare AI Model Safety Scores",
  description:
    "Compare child-safety scores of AI models side-by-side. See how GPT-4, Claude, Gemini, and other LLMs stack up across key safety categories.",
};

// Loading fallback for the comparison view
function ComparisonSkeleton() {
  return (
    <div className="space-y-6">
      {/* Selector skeleton */}
      <div className="h-12 w-full max-w-md animate-pulse rounded-lg bg-muted-bg" />

      {/* Cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-64 animate-pulse rounded-xl border border-card-border bg-card-bg"
          />
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
    <div className="mx-auto max-w-6xl px-4 py-12">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Compare Models</span>
      </nav>

      {/* Header */}
      <header className="mt-6 mb-8">
        <h1 className="text-3xl font-bold">Compare AI Models</h1>
        <p className="mt-2 text-muted">
          Select 2-4 models to compare their child-safety scores side-by-side
          across all evaluation categories.
        </p>
      </header>

      {/* Comparison View */}
      <Suspense fallback={<ComparisonSkeleton />}>
        <ComparisonContent />
      </Suspense>
    </div>
  );
}
