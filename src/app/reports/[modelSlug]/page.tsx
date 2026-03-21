import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import crypto from "crypto";
import { getModelWithScore } from "@/db/queries/models";
import { ScoreRing } from "@/components/ui/score-ring";
import { LetterGradeBadge } from "@/components/ui/letter-grade";
import { ColorBar } from "@/components/ui/color-bar";
import { ShareButtons, EmbedCode } from "@/components/reports";
import { PARENTBENCH_CATEGORY_META, PARENTBENCH_CATEGORY_ORDER } from "@/lib/constants";
import type { LetterGrade } from "@/types/model";

// Must match the salt in the reports API and verify page
const REPORT_ID_SALT = process.env.REPORT_ID_SALT || "parentbench-default-salt-change-in-prod";

/**
 * Generate a salted report ID based on model, date, and secret
 * Uses HMAC to prevent enumeration attacks
 */
function generateReportId(modelSlug: string, date: Date, modelId: string): string {
  const dateStr = date.toISOString().split("T")[0];
  const hmac = crypto
    .createHmac("sha256", REPORT_ID_SALT)
    .update(`${modelId}-${modelSlug}-${dateStr}`)
    .digest("hex")
    .slice(0, 16);
  return hmac;
}

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

  // Generate verification URL with salted HMAC report ID
  const reportId = generateReportId(modelSlug, score.computedAt, model.id);
  const verifyUrl = `${baseUrl}/verify/${reportId}`;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 flex-wrap">
            <li>
              <Link href="/" className="hover:text-foreground transition-colors">
                Home
              </Link>
            </li>
            <li className="text-card-border">/</li>
            <li>
              <Link href="/leaderboard" className="hover:text-foreground transition-colors">
                Leaderboard
              </Link>
            </li>
            <li className="text-card-border">/</li>
            <li>
              <Link href={`/model/${modelSlug}`} className="hover:text-foreground transition-colors">
                {model.name}
              </Link>
            </li>
            <li className="text-card-border">/</li>
            <li className="text-foreground font-medium">Report</li>
          </ol>
        </nav>

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Safety Report Card
          </h1>
          <p className="mt-3 text-muted text-lg">
            Download, share, or embed this verified report card for {model.name}
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
        <div className="rounded-3xl border-2 border-card-border bg-card-bg overflow-hidden elevation-3">
          {/* Gradient header bar */}
          <div className="h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500" />

          <div className="p-6 sm:p-8">
            {/* Logo */}
            <div className="mb-8 text-center">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">PARENTBENCH</h2>
              <p className="text-sm text-muted mt-1">AI Child Safety Report Card</p>
            </div>

            {/* Model Info */}
            <div className="mb-8 rounded-xl border border-card-border bg-muted-bg/50 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold">{model.name}</h3>
                  <p className="text-muted">{model.provider.name}</p>
                </div>
                <div className="text-right text-sm text-muted">
                  <p>Evaluation Date</p>
                  <p className="font-medium text-foreground">
                    {score.computedAt.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Overall Score - Centered hero section */}
            <div className="mb-10 flex flex-col items-center py-4">
              <ScoreRing score={score.overallScore} size="lg" showGrade />
              <div className="mt-5">
                <LetterGradeBadge grade={score.overallGrade as LetterGrade} size="lg" />
              </div>
              <p className="mt-3 text-sm text-muted font-medium">Overall Child Safety Score</p>
            </div>

            {/* Category Breakdown */}
            <div>
              <h4 className="mb-5 border-b border-card-border pb-3 text-sm font-bold uppercase tracking-wider text-muted">
                Category Breakdown
              </h4>
              <div className="space-y-5">
                {PARENTBENCH_CATEGORY_ORDER.map((category) => {
                  const meta = PARENTBENCH_CATEGORY_META[category];
                  const categoryScore = score.categoryScores.find(
                    (cs) => cs.category === category
                  );
                  if (!categoryScore) return null;

                  return (
                    <div key={category} className="group">
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{meta.label}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-bold tabular-nums">
                            {categoryScore.score}
                          </span>
                          <LetterGradeBadge
                            grade={categoryScore.grade as LetterGrade}
                            size="sm"
                          />
                        </div>
                      </div>
                      <ColorBar score={categoryScore.score} height="sm" />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-10 pt-6 border-t border-card-border text-center">
              <Link
                href={verifyUrl}
                className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2 hover:underline transition-colors"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span className="text-sm font-semibold">Verified by ParentBench</span>
              </Link>
              <p className="text-xs text-muted">
                <Link
                  href={verifyUrl}
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                >
                  {verifyUrl}
                </Link>
              </p>
            </div>
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
        <div className="mt-10 pt-6 border-t border-card-border flex flex-wrap gap-6">
          <Link
            href={`/model/${modelSlug}`}
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors group"
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
              className="transition-transform group-hover:-translate-x-1"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            View model details
          </Link>
          <Link
            href="/compare"
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
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
    </div>
  );
}
