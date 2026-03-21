"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ============================================================================
// TYPES
// ============================================================================

type FormState = "idle" | "approving" | "rejecting" | "success" | "error";

interface ReviewFormProps {
  submissionId: string;
}

const AGE_BRACKETS = [
  { value: "6-9", label: "6-9", fullLabel: "6-9 years" },
  { value: "10-12", label: "10-12", fullLabel: "10-12 years" },
  { value: "13-15", label: "13-15", fullLabel: "13-15 years" },
];

const SEVERITY_OPTIONS = [
  {
    value: "critical",
    label: "Critical",
    description: "Immediate harm potential",
    color: "text-error",
    bg: "bg-error/10",
    border: "border-error/30",
    ring: "ring-error/20",
  },
  {
    value: "high",
    label: "High",
    description: "Significant safety concern",
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
    ring: "ring-warning/20",
  },
  {
    value: "medium",
    label: "Medium",
    description: "Moderate risk",
    color: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent/30",
    ring: "ring-accent/20",
  },
];

const BEHAVIOR_OPTIONS = [
  {
    value: "refuse",
    label: "Refuse",
    description: "Decline to engage",
    icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",
  },
  {
    value: "safe_response",
    label: "Safe Response",
    description: "Respond safely",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  },
  {
    value: "redirect",
    label: "Redirect",
    description: "Redirect to adult",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function ReviewForm({ submissionId }: ReviewFormProps) {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [successAction, setSuccessAction] = useState<"approve" | "reject" | null>(null);

  // Form fields
  const [reviewNotes, setReviewNotes] = useState("");
  const [severity, setSeverity] = useState<string>("high");
  const [ageBrackets, setAgeBrackets] = useState<string[]>(["6-9", "10-12", "13-15"]);
  const [expectedBehavior, setExpectedBehavior] = useState<string>("refuse");

  function toggleAgeBracket(bracket: string) {
    setAgeBrackets((prev) =>
      prev.includes(bracket)
        ? prev.filter((b) => b !== bracket)
        : [...prev, bracket]
    );
  }

  async function handleAction(action: "approve" | "reject") {
    setFormState(action === "approve" ? "approving" : "rejecting");
    setError(null);

    const body: Record<string, unknown> = {
      action,
      reviewNotes: reviewNotes || undefined,
    };

    if (action === "approve") {
      body.severity = severity;
      body.ageBrackets = ageBrackets;
      body.expectedBehavior = expectedBehavior;
    }

    try {
      const response = await fetch(`/api/admin/submissions/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        setFormState("success");
        setSuccessAction(action);
        setTimeout(() => {
          router.push("/admin/submissions");
          router.refresh();
        }, 1500);
      } else {
        setFormState("error");
        setError(data.error || "An error occurred");
      }
    } catch {
      setFormState("error");
      setError("Failed to submit review. Please try again.");
    }
  }

  const isLoading = formState === "approving" || formState === "rejecting";

  // Success state
  if (formState === "success") {
    const isApproved = successAction === "approve";
    return (
      <div className={`rounded-xl border p-6 sm:p-8 text-center animate-[fade-in_0.3s_ease-out] ${
        isApproved
          ? "border-success/20 bg-success/5"
          : "border-muted bg-muted-bg/50"
      }`}>
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
          isApproved ? "bg-success/10" : "bg-muted-bg"
        }`}>
          <svg
            className={`h-7 w-7 ${isApproved ? "text-success" : "text-muted"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="mt-4 text-lg font-semibold text-foreground">
          {isApproved ? "Submission Approved!" : "Submission Rejected"}
        </p>
        <p className="mt-1 text-sm text-muted">
          {isApproved
            ? "Test case created and email notification sent."
            : "Email notification sent to submitter."}
        </p>
        <p className="mt-4 text-sm text-muted animate-pulse">
          Redirecting to submissions list...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error display */}
      {formState === "error" && error && (
        <div className="rounded-xl border border-error/20 bg-error/5 p-4 flex items-start gap-3 animate-[shake_0.4s_ease-out]">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-error/10">
            <svg className="h-4 w-4 text-error" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-error">Error</p>
            <p className="text-sm text-error/80">{error}</p>
          </div>
        </div>
      )}

      {/* Review notes */}
      <div>
        <label
          htmlFor="reviewNotes"
          className="block text-sm font-medium text-foreground mb-1"
        >
          Review Notes
          <span className="text-muted font-normal ml-1">(optional)</span>
        </label>
        <p className="text-sm text-muted mb-2">
          Internal notes about this review decision. Included in submitter notification.
        </p>
        <textarea
          id="reviewNotes"
          value={reviewNotes}
          onChange={(e) => setReviewNotes(e.target.value)}
          disabled={isLoading}
          rows={2}
          placeholder="e.g., Great example of manipulation resistance testing..."
          className="block w-full rounded-xl border border-card-border bg-card-bg px-4 py-3 text-foreground placeholder:text-muted/60 transition-all duration-200 focus:border-accent focus:ring-4 focus:ring-accent/10 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed resize-none"
        />
      </div>

      {/* Approval settings */}
      <div className="rounded-xl border border-card-border bg-muted-bg/20 p-5 sm:p-6 space-y-6">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <h4 className="font-semibold text-foreground">
            Approval Settings
          </h4>
        </div>

        {/* Severity */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-3">
            Severity Level
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            {SEVERITY_OPTIONS.map((option) => {
              const isSelected = severity === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSeverity(option.value)}
                  disabled={isLoading}
                  className={`relative rounded-xl border p-3 sm:p-4 text-left transition-all duration-200 tap-target ${
                    isSelected
                      ? `${option.border} ${option.bg} ring-2 ${option.ring}`
                      : "border-card-border bg-card-bg hover:border-muted/50"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span className={`block text-sm font-semibold ${isSelected ? option.color : "text-foreground"}`}>
                    {option.label}
                  </span>
                  <span className="block text-xs text-muted mt-0.5 hidden sm:block">
                    {option.description}
                  </span>
                  {/* Selection indicator */}
                  {isSelected && (
                    <div className={`absolute top-2 right-2 h-2 w-2 rounded-full ${option.color.replace('text-', 'bg-')}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Age Brackets */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-3">
            Age Brackets
          </label>
          <div className="flex flex-wrap gap-2">
            {AGE_BRACKETS.map((bracket) => {
              const isSelected = ageBrackets.includes(bracket.value);
              return (
                <button
                  key={bracket.value}
                  type="button"
                  onClick={() => toggleAgeBracket(bracket.value)}
                  disabled={isLoading}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 tap-target ${
                    isSelected
                      ? "bg-accent text-white shadow-md shadow-accent/25"
                      : "bg-card-bg border border-card-border text-muted hover:border-muted/50 hover:text-foreground"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isSelected && (
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  {bracket.fullLabel}
                </button>
              );
            })}
          </div>
          {ageBrackets.length === 0 && (
            <p className="mt-2 text-sm text-error flex items-center gap-1.5">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Select at least one age bracket
            </p>
          )}
        </div>

        {/* Expected Behavior */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-3">
            Expected Behavior
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            {BEHAVIOR_OPTIONS.map((option) => {
              const isSelected = expectedBehavior === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setExpectedBehavior(option.value)}
                  disabled={isLoading}
                  className={`relative rounded-xl border p-3 sm:p-4 text-left transition-all duration-200 tap-target ${
                    isSelected
                      ? "border-accent bg-accent/5 ring-2 ring-accent/20"
                      : "border-card-border bg-card-bg hover:border-muted/50"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <svg
                      className={`h-4 w-4 ${isSelected ? "text-accent" : "text-muted"}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={option.icon} />
                    </svg>
                    <span className={`text-sm font-semibold ${isSelected ? "text-accent" : "text-foreground"}`}>
                      {option.label}
                    </span>
                  </div>
                  <span className="block text-xs text-muted hidden sm:block">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action buttons - sticky on mobile */}
      <div className="sticky bottom-0 -mx-6 -mb-6 p-4 sm:static sm:mx-0 sm:mb-0 sm:p-0 bg-card-bg sm:bg-transparent border-t border-card-border sm:border-0">
        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => handleAction("reject")}
            disabled={isLoading}
            className="flex-1 rounded-xl border border-error/30 bg-card-bg px-4 py-3.5 text-error font-semibold hover:bg-error/5 focus:outline-none focus:ring-2 focus:ring-error/20 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 tap-target flex items-center justify-center gap-2"
          >
            {formState === "rejecting" ? (
              <>
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Rejecting...
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Reject
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleAction("approve")}
            disabled={isLoading || ageBrackets.length === 0}
            className="flex-1 rounded-xl bg-gradient-to-r from-success to-emerald-600 px-4 py-3.5 text-white font-semibold shadow-lg shadow-success/25 hover:shadow-xl hover:shadow-success/30 focus:outline-none focus:ring-2 focus:ring-success/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 tap-target flex items-center justify-center gap-2"
          >
            {formState === "approving" ? (
              <>
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating Test Case...
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Approve & Create
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
