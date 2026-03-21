import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getModelWithScore } from "@/db/queries/models";
import { ScoreRing } from "@/components/ui/score-ring";
import { LetterGradeBadge } from "@/components/ui/letter-grade";
import { ColorBar } from "@/components/ui/color-bar";
import { ShareButtons, EmbedCode } from "@/components/reports";
import { PARENTBENCH_CATEGORY_META, PARENTBENCH_CATEGORY_ORDER } from "@/lib/constants";
import type { LetterGrade } from "@/types/model";

type Props = {
  params: Promise<{ modelSlug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { modelSlug } = await params;
  const model = await getModelWithScore(modelSlug);

  if (!model || !model.latestScore) {
    return { title: "Report not found" };
  }

  return {
    title: `${model.name} Safety Report Card | ParentBench`,
    description: `ParentBench child-safety report for ${model.name}. Overall score ${model.latestScore.overallScore}/100 (${model.latestScore.overallGrade}).`,
    openGraph: {
      title: `${model.name} Safety Report Card`,
      description: `Safety Score: ${model.latestScore.overallScore}/100 (${model.latestScore.overallGrade})`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${model.name} Safety Report Card`,
      description: `Safety Score: ${model.latestScore.overallScore}/100 (${model.latestScore.overallGrade})`,
    },
  };
}

export default async function ReportPage({ params }: Props) {
  const { modelSlug } = await params;
  const model = await getModelWithScore(modelSlug);

  if (!model || !model.latestScore) {
    notFound();
  }

  const score = model.latestScore;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://parentbench.org";
  const reportUrl = `${baseUrl}/reports/${modelSlug}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link href="/leaderboard" className="hover:text-foreground">
          Leaderboard
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/model/${modelSlug}`} className="hover:text-foreground">
          {model.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Report</span>
      </nav>

      {/* Header */}
      <header className="mt-6 mb-6">
        <h1 className="text-3xl font-bold">Safety Report Card</h1>
        <p className="mt-2 text-muted">
          Download, share, or embed this report card for {model.name}
        </p>
      </header>

      {/* Share Buttons */}
      <ShareButtons
        url={reportUrl}
        title={`${model.name} ParentBench Safety Score: ${score.overallScore}/100 (${score.overallGrade})`}
        description={`Check out ${model.name}'s child safety score on ParentBench`}
        modelSlug={modelSlug}
        className="mb-8"
      />

      {/* Report Card Preview */}
      <div className="rounded-2xl border-2 border-card-border bg-card-bg p-8 shadow-lg">
        {/* Logo */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold">PARENTBENCH</h2>
          <p className="text-sm text-muted">AI Safety Report Card</p>
        </div>

        {/* Model Info */}
        <div className="mb-8 rounded-lg border border-card-border bg-muted-bg p-4">
          <h3 className="text-xl font-bold">{model.name}</h3>
          <p className="text-sm text-muted">{model.provider.name}</p>
          <p className="mt-2 text-xs text-muted">
            Evaluation Date:{" "}
            {score.computedAt.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Overall Score */}
        <div className="mb-8 flex flex-col items-center">
          <ScoreRing score={score.overallScore} size="lg" showGrade />
          <div className="mt-4">
            <LetterGradeBadge grade={score.overallGrade as LetterGrade} size="lg" />
          </div>
          <p className="mt-2 text-sm text-muted">Overall Child Safety Score</p>
        </div>

        {/* Category Breakdown */}
        <div>
          <h4 className="mb-4 border-b border-card-border pb-2 text-sm font-bold">
            Category Breakdown
          </h4>
          <div className="space-y-4">
            {PARENTBENCH_CATEGORY_ORDER.map((category) => {
              const meta = PARENTBENCH_CATEGORY_META[category];
              const categoryScore = score.categoryScores.find(
                (cs) => cs.category === category
              );
              if (!categoryScore) return null;

              return (
                <div key={category} className="flex items-center gap-4">
                  <div className="w-40 shrink-0 text-sm">{meta.label}</div>
                  <div className="flex-1">
                    <ColorBar score={categoryScore.score} height="sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">
                      {categoryScore.score}
                    </span>
                    <LetterGradeBadge
                      grade={categoryScore.grade as LetterGrade}
                      size="sm"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 border-t border-card-border pt-4 text-center">
          <p className="text-xs text-muted">
            Verified by ParentBench
          </p>
          <Link
            href={`/verify/${modelSlug}`}
            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {reportUrl}
          </Link>
        </div>
      </div>

      {/* Embed Code */}
      <div className="mt-8">
        <EmbedCode
          modelSlug={modelSlug}
          modelName={model.name}
          overallScore={score.overallScore}
          overallGrade={score.overallGrade}
        />
      </div>

      {/* Back Links */}
      <div className="mt-8 flex flex-wrap gap-4">
        <Link
          href={`/model/${modelSlug}`}
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          View model details
        </Link>
        <Link
          href="/compare"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
          Compare with other models
        </Link>
      </div>
    </div>
  );
}
