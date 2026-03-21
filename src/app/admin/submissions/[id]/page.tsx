import Link from "next/link";
import { notFound } from "next/navigation";
import { getSubmissionById } from "@/db/queries/submissions";
import { ReviewForm } from "./review-form";

// ============================================================================
// HELPERS
// ============================================================================

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const maskedLocal = local.charAt(0) + "***";
  return `${maskedLocal}@${domain}`;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: string }> = {
    pending: {
      bg: "bg-warning/10",
      text: "text-warning",
      icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    approved: {
      bg: "bg-success/10",
      text: "text-success",
      icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    rejected: {
      bg: "bg-error/10",
      text: "text-error",
      icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
    },
  };

  const { bg, text, icon } = config[status] || config.pending;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${bg} ${text}`}>
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
      </svg>
      <span className="capitalize">{status}</span>
    </span>
  );
}

function MetadataCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-card-border bg-muted-bg/30 p-4">
      <div className="flex items-center gap-2 text-muted mb-1">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-semibold text-foreground truncate" title={value}>
        {value}
      </p>
    </div>
  );
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function SubmissionReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const submission = await getSubmissionById(id);

  if (!submission) {
    notFound();
  }

  const isPending = submission.status === "pending";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          href="/admin/submissions"
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground transition-colors tap-target"
        >
          <svg
            className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Submissions
        </Link>
        <StatusBadge status={submission.status} />
      </div>

      {/* Main content card */}
      <div className="rounded-2xl border border-card-border bg-card-bg elevation-2 overflow-hidden">
        {/* Card header */}
        <div className="px-6 py-5 border-b border-card-border bg-muted-bg/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
              <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                Submission Details
              </h1>
              <p className="text-sm text-muted">
                ID: <code className="font-mono text-xs bg-muted-bg px-1.5 py-0.5 rounded">{submission.id.slice(0, 8)}</code>
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Metadata grid - responsive */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MetadataCard
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
              label="Submitter"
              value={maskEmail(submission.email)}
            />
            <MetadataCard
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              }
              label="Category"
              value={submission.category.label}
            />
            <MetadataCard
              icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
              label="Submitted"
              value={new Date(submission.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            />
          </div>

          {/* Prompt section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-warning/10">
                <svg className="h-3.5 w-3.5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-foreground">Test Prompt</h3>
            </div>
            <div className="rounded-xl bg-warning/5 border border-warning/20 p-4 sm:p-5">
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                {submission.prompt}
              </p>
            </div>
          </div>

          {/* Expected Response section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-success/10">
                <svg className="h-3.5 w-3.5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-foreground">Expected Safe Response</h3>
            </div>
            <div className="rounded-xl bg-success/5 border border-success/20 p-4 sm:p-5">
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                {submission.expectedResponse}
              </p>
            </div>
          </div>

          {/* Review info (for already reviewed submissions) */}
          {!isPending && submission.reviewedAt && (
            <div className="border-t border-card-border pt-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="h-5 w-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <h3 className="text-sm font-semibold text-foreground">Review Information</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg bg-muted-bg/50 p-4">
                  <p className="text-xs font-medium text-muted uppercase tracking-wider mb-1">
                    Reviewed At
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {new Date(submission.reviewedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {submission.reviewNotes && (
                  <div className="rounded-lg bg-muted-bg/50 p-4 sm:col-span-2">
                    <p className="text-xs font-medium text-muted uppercase tracking-wider mb-1">
                      Review Notes
                    </p>
                    <p className="text-sm text-foreground">
                      {submission.reviewNotes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Review Actions (only for pending) */}
      {isPending && (
        <div className="rounded-2xl border border-card-border bg-card-bg elevation-2 overflow-hidden">
          <div className="px-6 py-5 border-b border-card-border bg-muted-bg/20">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Review Actions
                </h2>
                <p className="text-sm text-muted">
                  Approve to create a new test case, or reject if not suitable
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <ReviewForm submissionId={submission.id} />
          </div>
        </div>
      )}
    </div>
  );
}
