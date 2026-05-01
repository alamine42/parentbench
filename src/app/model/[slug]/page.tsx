import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getParentBenchScoreBySlug, computeParentBenchRank, getParentBenchModelCount, getParentBenchScoresByModel } from "@/lib/parentbench";
import { getModelBySlug, getAllModelSlugs } from "@/lib/data";
import { ScoreRing } from "@/components/ui/score-ring";
import { LetterGradeBadge } from "@/components/ui/letter-grade";
import { ColorBar } from "@/components/ui/color-bar";
import { MethodologyVersionPill } from "@/components/parentbench/methodology-version-pill";
import { OverAlignmentSection } from "@/components/parentbench/over-alignment-section";
import { SurfaceComparison } from "@/components/parentbench/surface-comparison";
import { PARENTBENCH_CATEGORY_META, PARENTBENCH_CATEGORY_ORDER } from "@/lib/constants";
import { db } from "@/db";
import { testCases } from "@/db/schema";
import { inArray } from "drizzle-orm";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const slugs = await getAllModelSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [model, parentBenchResult] = await Promise.all([
    getModelBySlug(slug),
    getParentBenchScoreBySlug(slug),
  ]);

  if (!model && !parentBenchResult) {
    return { title: "Model not found" };
  }

  const modelName = model?.name ?? parentBenchResult?.modelSlug ?? "Model";
  const scoreSource = parentBenchResult ?? (model
    ? {
        overallScore: model.overallScore,
        overallGrade: model.overallGrade,
      }
    : null);

  return {
    title: `${modelName} Child-Safety Score`,
    description: scoreSource
      ? `ParentBench child-safety grade for ${modelName}. Overall score ${scoreSource.overallScore}/100 (${scoreSource.overallGrade}).`
      : `ParentBench child-safety report for ${modelName}.`,
  };
}

export default async function ModelPage({ params }: Props) {
  const { slug } = await params;
  const [modelInfo, parentBenchResult, rank, totalModels, surfaceResults] = await Promise.all([
    getModelBySlug(slug),
    getParentBenchScoreBySlug(slug),
    computeParentBenchRank(slug),
    getParentBenchModelCount(),
    getParentBenchScoresByModel(slug),
  ]);

  if (!parentBenchResult) {
    notFound();
  }

  const refusedIds = parentBenchResult.refusedBenignCaseIds ?? [];
  const refusedCases =
    refusedIds.length > 0
      ? await db
          .select({ id: testCases.id, prompt: testCases.prompt })
          .from(testCases)
          .where(inArray(testCases.id, refusedIds))
      : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <nav className="text-sm text-muted">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link href="/leaderboard" className="hover:text-foreground">
          Leaderboard
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{modelInfo?.name ?? parentBenchResult.modelSlug}</span>
      </nav>

      <header className="mt-6 rounded-2xl border border-card-border bg-card-bg p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            {modelInfo?.provider.logo && (
              <Image
                src={modelInfo.provider.logo}
                alt={modelInfo.provider.name}
                width={56}
                height={56}
                className="rounded-xl shrink-0"
              />
            )}
            <div>
              <p className="text-sm text-muted">Overall grade</p>
              <h1 className="text-3xl font-bold">{modelInfo?.name ?? parentBenchResult.modelSlug}</h1>
              <p className="text-sm text-muted">{modelInfo?.provider.name ?? "Unknown provider"}</p>
              {rank && totalModels && (
                <p className="mt-2 text-sm text-muted">
                  Ranked #{rank} of {totalModels} models
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ScoreRing score={parentBenchResult.overallScore} size="lg" showGrade />
            <LetterGradeBadge grade={parentBenchResult.overallGrade} size="lg" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <p className="text-sm text-muted">
            Evaluated on {new Date(parentBenchResult.evaluatedDate).toLocaleDateString("en-US")}
          </p>
          <MethodologyVersionPill version={parentBenchResult.methodologyVersion} />
          <Link
            href={`/model/${slug}/history`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 3v18h18" />
              <path d="M7 12l4-4 4 4 5-5" />
            </svg>
            View score history
          </Link>
        </div>
      </header>

      {surfaceResults.length >= 2 ? (
        <div className="mt-8">
          <SurfaceComparison surfaces={surfaceResults} />
        </div>
      ) : null}

      <OverAlignmentSection
        safetyScore={parentBenchResult.overallScore}
        falseRefusalRate={parentBenchResult.falseRefusalRate}
        netHelpfulness={parentBenchResult.netHelpfulness}
        benignRefusalCount={parentBenchResult.benignRefusalCount}
        benignTotalCount={parentBenchResult.benignTotalCount}
        refusedCases={refusedCases}
      />

      <section className="mt-8 rounded-2xl border border-card-border bg-card-bg p-6">
        <h2 className="text-xl font-semibold">Category breakdown</h2>
        <p className="mt-2 text-sm text-muted">Scores are weighted averages of all severity levels within each category.</p>

        <div className="mt-6 space-y-4">
          {PARENTBENCH_CATEGORY_ORDER.map((category) => {
            const meta = PARENTBENCH_CATEGORY_META[category];
            const categoryScore = parentBenchResult.categoryScores.find((item) => item.category === category);
            if (!categoryScore) return null;
            return (
              <div key={category} className="rounded-xl border border-card-border/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{meta.label}</p>
                    <p className="text-xs text-muted">{meta.question}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <LetterGradeBadge grade={categoryScore.grade} size="sm" />
                    <span className="text-lg font-semibold">{categoryScore.score}</span>
                  </div>
                </div>
                <div className="mt-3">
                  <ColorBar score={categoryScore.score} />
                </div>
                <p className="mt-2 text-xs text-muted">
                  Pass rate {categoryScore.passRate}% across {categoryScore.testCount} test cases.
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-8 rounded-2xl border border-card-border bg-card-bg p-6">
        <h2 className="text-xl font-semibold">Contribute new findings</h2>
        <p className="mt-2 text-sm text-muted">
          If you’ve seen {modelInfo?.name ?? "this model"} behave poorly with kids, let us know. Verified reports impact the next score update.
        </p>
        <Link
          href={`/report?model=${parentBenchResult.modelSlug}`}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          Report an issue
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
