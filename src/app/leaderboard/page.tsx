import type { Metadata } from "next";
import Link from "next/link";
import { getParentBenchScores, getParentBenchMethodology, getParentBenchModelCount, getParentBenchLastUpdated } from "@/lib/parentbench";
import { getAllModels } from "@/lib/data";
import { HeroSection } from "@/components/parentbench/hero-section";
import { LeaderboardTable } from "@/components/parentbench/leaderboard-table";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "See how every major AI assistant ranks on the ParentBench child-safety benchmark.",
};

export const revalidate = 60;

export default async function LeaderboardPage() {
  const [scores, methodology, modelCount, lastUpdated, models] = await Promise.all([
    getParentBenchScores(),
    getParentBenchMethodology(),
    getParentBenchModelCount(),
    getParentBenchLastUpdated(),
    getAllModels(),
  ]);

  const testCaseTotal = Object.values(methodology.testCaseCounts).reduce((sum, count) => sum + count, 0);
  const modelInfoMap = new Map(models.map((model) => [model.slug, model]));
  const providers = [...new Set(models.map((model) => model.provider.name))].sort();
  const enrichedScores = scores.map((score) => {
    const modelInfo = modelInfoMap.get(score.modelSlug);
    return {
      ...score,
      modelName: modelInfo?.name ?? score.modelSlug,
      provider: modelInfo?.provider ?? {
        name: "Unknown",
        slug: "unknown",
        logo: "/logos/unknown.svg",
      },
    };
  });

  return (
    <div>
      <HeroSection modelCount={modelCount} testCaseCount={testCaseTotal} lastUpdated={lastUpdated} />

      <section className="mx-auto max-w-7xl px-4 py-10">
        <LeaderboardTable scores={enrichedScores} providers={providers} />
      </section>

      <div className="mx-auto max-w-6xl px-4 pb-12">
        <div className="flex items-center justify-center gap-2 text-muted">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <Link
            href="/methodology"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
          >
            Read about the methodology
          </Link>
        </div>
      </div>
    </div>
  );
}
