import type { Metadata } from "next";
import { getParentBenchScores, getParentBenchMethodology, getParentBenchModelCount, getParentBenchLastUpdated } from "@/lib/parentbench";
import { getAllModels } from "@/lib/data";
import { HeroSection } from "@/components/parentbench/hero-section";
import { LeaderboardTable } from "@/components/parentbench/leaderboard-table";
import { MethodologySection } from "@/components/parentbench/methodology-section";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "See how every major AI assistant ranks on the ParentBench child-safety benchmark.",
};

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

      <div className="mx-auto max-w-6xl px-4">
        <MethodologySection methodology={methodology} />
      </div>
    </div>
  );
}
