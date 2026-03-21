import type { Metadata } from "next";
import Link from "next/link";
import { getAllModelsWithScores } from "@/db/queries/models";
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

/**
 * Find a model matching the report ID
 * Uses salted HMAC to prevent enumeration attacks
 */
async function findModelByReportId(reportId: string) {
  const models = await getAllModelsWithScores();

  for (const model of models) {
    if (!model.latestScore) continue;

    // Generate the HMAC for this model's latest score
    const hmac = generateReportId(model.slug, model.latestScore.computedAt, model.id);

    if (hmac === reportId) {
      return model;
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

  if (!model || !model.latestScore) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <div className="rounded-2xl border border-red-300 bg-red-50 p-8 dark:border-red-800 dark:bg-red-900/20">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto text-red-500"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <h1 className="mt-4 text-2xl font-bold text-red-700 dark:text-red-400">
            Report Not Found
          </h1>
          <p className="mt-2 text-red-600 dark:text-red-300">
            The report ID <code className="rounded bg-red-100 px-2 py-0.5 text-sm dark:bg-red-900/50">{reportId}</code> could not be verified.
          </p>
          <p className="mt-4 text-sm text-muted">
            This could mean the report is outdated, invalid, or the model has been removed.
          </p>
          <Link
            href="/leaderboard"
            className="mt-6 inline-flex rounded-full bg-foreground px-6 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            View All Models
          </Link>
        </div>
      </div>
    );
  }

  const score = model.latestScore;

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      {/* Verified Badge */}
      <div className="mb-8 flex flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-green-600 dark:text-green-400"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="mt-4 text-2xl font-bold text-green-700 dark:text-green-400">
          Report Verified
        </h1>
        <p className="mt-2 text-center text-muted">
          This is an authentic ParentBench safety report
        </p>
      </div>

      {/* Report Details */}
      <div className="rounded-2xl border border-card-border bg-card-bg p-6">
        {/* Model Info */}
        <div className="flex items-center justify-between gap-4 border-b border-card-border pb-4">
          <div>
            <h2 className="text-xl font-bold">{model.name}</h2>
            <p className="text-sm text-muted">{model.provider.name}</p>
          </div>
          <ScoreRing score={score.overallScore} size="md" showGrade />
        </div>

        {/* Details Grid */}
        <div className="mt-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Report ID</span>
            <code className="rounded bg-muted-bg px-2 py-0.5 text-xs">
              {reportId}
            </code>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Overall Score</span>
            <span className="font-semibold">{score.overallScore}/100</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Grade</span>
            <LetterGradeBadge grade={score.overallGrade as LetterGrade} size="sm" />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Evaluation Date</span>
            <span>
              {score.computedAt.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Data Quality</span>
            <span className="capitalize">{score.dataQuality}</span>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="mt-6 flex flex-wrap justify-center gap-4">
        <Link
          href={`/model/${model.slug}`}
          className="inline-flex items-center gap-2 rounded-lg border border-card-border bg-card-bg px-4 py-2 text-sm font-medium transition hover:bg-muted-bg"
        >
          View Full Details
        </Link>
        <Link
          href={`/reports/${model.slug}`}
          className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
        >
          Download Report
        </Link>
      </div>

      {/* Trust Info */}
      <div className="mt-8 rounded-lg border border-card-border bg-muted-bg p-4">
        <h3 className="text-sm font-semibold">About ParentBench Verification</h3>
        <p className="mt-2 text-xs text-muted">
          ParentBench reports include cryptographic verification codes that link
          to our official evaluation data. This ensures report authenticity and
          prevents tampering. Each report ID is uniquely generated based on the
          model and evaluation date.
        </p>
      </div>
    </div>
  );
}
