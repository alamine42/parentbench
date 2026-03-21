import type { Metadata } from "next";
import Link from "next/link";
import { getAllModelsWithScores, getModelScoreHistoryWithCategories } from "@/db/queries/models";
import { ScoreRing } from "@/components/ui/score-ring";
import { LetterGradeBadge } from "@/components/ui/letter-grade";
import type { LetterGrade } from "@/types/model";
import crypto from "crypto";

type Props = {
  params: Promise<{ reportId: string }>;
};

// Must match the salt in the reports API
const REPORT_ID_SALT = process.env.REPORT_ID_SALT || "parentbench-default-salt-change-in-prod";

/**
 * Generate the same salted HMAC as the reports API
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

type MatchedScore = {
  overallScore: number;
  overallGrade: string;
  computedAt: Date;
  dataQuality: string;
  categoryScores: Array<{
    category: string;
    score: number;
    grade: string;
    passRate: number;
    testCount: number;
  }>;
};

type VerifiedModel = {
  id: string;
  name: string;
  slug: string;
  provider: { name: string };
  matchedScore: MatchedScore;
};

/**
 * Find a model matching the report ID by checking both latest and historical scores.
 * This ensures report URLs remain valid even after new evaluations are published.
 * Uses salted HMAC to prevent enumeration attacks.
 */
async function findModelByReportId(reportId: string): Promise<VerifiedModel | null> {
  const models = await getAllModelsWithScores();

  for (const model of models) {
    // First check the latest score (most common case)
    if (model.latestScore) {
      const hmac = generateReportId(model.slug, model.latestScore.computedAt, model.id);
      if (hmac === reportId) {
        return {
          id: model.id,
          name: model.name,
          slug: model.slug,
          provider: model.provider,
          matchedScore: {
            overallScore: model.latestScore.overallScore,
            overallGrade: model.latestScore.overallGrade,
            computedAt: model.latestScore.computedAt,
            dataQuality: model.latestScore.dataQuality,
            categoryScores: model.latestScore.categoryScores,
          },
        };
      }
    }

    // If not found in latest, check historical scores
    const history = await getModelScoreHistoryWithCategories(model.id, { limit: 50 });

    for (const entry of history) {
      const hmac = generateReportId(model.slug, entry.computedAt, model.id);
      if (hmac === reportId) {
        return {
          id: model.id,
          name: model.name,
          slug: model.slug,
          provider: model.provider,
          matchedScore: {
            overallScore: entry.overallScore,
            overallGrade: entry.overallGrade,
            computedAt: entry.computedAt,
            dataQuality: entry.dataQuality,
            categoryScores: entry.categoryScores,
          },
        };
      }
    }
  }

  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { reportId } = await params;
  const model = await findModelByReportId(reportId);

  if (!model) {
    return { title: "Report not found | ParentBench" };
  }

  return {
    title: `Verify Report: ${model.name} | ParentBench`,
    description: `Verification page for ${model.name}'s ParentBench safety score.`,
  };
}

export default async function VerifyPage({ params }: Props) {
  const { reportId } = await params;
  const model = await findModelByReportId(reportId);

  if (!model) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-800/50 dark:bg-red-900/20 elevation-2">
            {/* Error icon */}
            <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-red-500"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-red-700 dark:text-red-400">
              Report Not Found
            </h1>
            <p className="mt-3 text-red-600 dark:text-red-300">
              The report ID{" "}
              <code className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-mono dark:bg-red-900/50">
                {reportId}
              </code>{" "}
              could not be verified.
            </p>
            <p className="mt-4 text-sm text-muted">
              This could mean the report is outdated, invalid, or the model has been removed from our database.
            </p>
            <Link
              href="/leaderboard"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background hover:opacity-90 transition-all tap-target"
            >
              View All Models
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const score = model.matchedScore;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-xl px-4 sm:px-6 py-12 sm:py-16">
        {/* Verified Badge - Hero section */}
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="relative">
            {/* Animated ring */}
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" style={{ animationDuration: "2s" }} />
            {/* Icon container */}
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
          <h1 className="mt-6 text-3xl font-bold text-emerald-700 dark:text-emerald-400">
            Report Verified
          </h1>
          <p className="mt-2 text-muted max-w-sm">
            This is an authentic ParentBench safety report generated from our official evaluation data.
          </p>
        </div>

        {/* Report Details Card */}
        <div className="rounded-2xl border border-card-border bg-card-bg overflow-hidden elevation-2">
          {/* Model Info Header */}
          <div className="flex items-center justify-between gap-4 p-5 sm:p-6 border-b border-card-border bg-muted-bg/30">
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold truncate">{model.name}</h2>
              <p className="text-sm text-muted">{model.provider.name}</p>
            </div>
            <ScoreRing score={score.overallScore} size="md" showGrade />
          </div>

          {/* Details Grid */}
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex justify-between items-center text-sm py-2 border-b border-card-border/50">
              <span className="text-muted">Report ID</span>
              <code className="rounded-md bg-muted-bg px-2.5 py-1 text-xs font-mono">
                {reportId}
              </code>
            </div>
            <div className="flex justify-between items-center text-sm py-2 border-b border-card-border/50">
              <span className="text-muted">Overall Score</span>
              <span className="font-bold tabular-nums">{score.overallScore}/100</span>
            </div>
            <div className="flex justify-between items-center text-sm py-2 border-b border-card-border/50">
              <span className="text-muted">Grade</span>
              <LetterGradeBadge grade={score.overallGrade as LetterGrade} size="sm" />
            </div>
            <div className="flex justify-between items-center text-sm py-2 border-b border-card-border/50">
              <span className="text-muted">Evaluation Date</span>
              <span className="font-medium">
                {score.computedAt.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm py-2">
              <span className="text-muted">Data Quality</span>
              <span className="inline-flex items-center gap-1.5 capitalize">
                {score.dataQuality === "complete" && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                )}
                {score.dataQuality}
              </span>
            </div>
          </div>
        </div>

        {/* Action Links */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={`/model/${model.slug}`}
            className="inline-flex items-center gap-2 rounded-xl border border-card-border bg-card-bg px-5 py-2.5 text-sm font-medium transition-all hover:bg-muted-bg hover:border-muted elevation-1 hover:elevation-2 tap-target"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            View Full Details
          </Link>
          <Link
            href={`/reports/${model.slug}`}
            className="inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-all hover:opacity-90 elevation-2 tap-target"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download Report
          </Link>
        </div>

        {/* Trust Info */}
        <div className="mt-10 rounded-xl border border-card-border bg-muted-bg/50 p-5">
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold">About ParentBench Verification</h3>
              <p className="mt-1.5 text-xs text-muted leading-relaxed">
                ParentBench reports include cryptographic verification codes that link
                to our official evaluation data. This ensures report authenticity and
                prevents tampering. Each report ID is uniquely generated using a secure
                hash based on the model and evaluation date.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
