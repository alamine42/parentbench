"use client";

import { useState, useRef, useEffect } from "react";

// ============================================================================
// TYPES
// ============================================================================

type FormState = "idle" | "loading" | "success" | "error";

interface Category {
  id: string;
  name: string;
  label: string;
  description: string;
}

interface SubmissionFormProps {
  categories: Category[];
}

// ============================================================================
// ANIMATED CHECKMARK COMPONENT
// ============================================================================

function AnimatedCheckmark() {
  return (
    <div className="relative">
      {/* Ripple effect */}
      <div className="absolute inset-0 animate-ping rounded-full bg-success/30" />
      {/* Icon container */}
      <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-gradient-to-br from-success to-emerald-600 shadow-lg shadow-success/25">
        <svg
          className="h-8 w-8 sm:h-10 sm:w-10 text-white animate-[scale-in_0.3s_ease-out]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
            className="animate-[draw-check_0.5s_ease-out_0.2s_both]"
            style={{
              strokeDasharray: 24,
              strokeDashoffset: 24,
            }}
          />
        </svg>
      </div>
    </div>
  );
}

// ============================================================================
// CHARACTER COUNTER COMPONENT
// ============================================================================

function CharacterCounter({
  current,
  max,
  min,
}: {
  current: number;
  max: number;
  min: number;
}) {
  const percentage = (current / max) * 100;
  const isBelowMin = current > 0 && current < min;
  const isNearMax = percentage > 80;
  const isAtMax = current >= max;
  const isValid = current >= min && current <= max;

  return (
    <div className="flex items-center justify-end gap-3 mt-2">
      {/* Progress bar - visible on all screens */}
      <div className="h-1.5 w-20 rounded-full bg-muted-bg/60 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${
            isAtMax
              ? "bg-error"
              : isNearMax
              ? "bg-warning"
              : isBelowMin
              ? "bg-warning"
              : isValid
              ? "bg-success"
              : "bg-muted"
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {/* Count with status indicator */}
      <span
        className={`text-xs font-medium tabular-nums transition-all duration-200 flex items-center gap-1.5 ${
          isAtMax
            ? "text-error"
            : isNearMax
            ? "text-warning"
            : isBelowMin
            ? "text-warning"
            : "text-muted"
        }`}
      >
        {isValid && (
          <svg className="w-3 h-3 text-success" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
        {current.toLocaleString()} / {max.toLocaleString()}
      </span>
    </div>
  );
}

// ============================================================================
// FORM FIELD WRAPPER
// ============================================================================

function FormField({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  const hintId = htmlFor ? `${htmlFor}-hint` : undefined;
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;

  return (
    <div className="group">
      <label htmlFor={htmlFor} className="block">
        <span className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-error ml-0.5" aria-hidden="true">*</span>}
          {required && <span className="sr-only">(required)</span>}
        </span>
        {hint && (
          <span id={hintId} className="block mt-0.5 text-sm text-muted leading-snug">
            {hint}
          </span>
        )}
      </label>
      <div className="mt-2">{children}</div>
      {error && (
        <p id={errorId} className="mt-1.5 text-sm text-error flex items-center gap-1.5" role="alert">
          <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SubmissionForm({ categories }: SubmissionFormProps) {
  const [formState, setFormState] = useState<FormState>("idle");
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const [email, setEmail] = useState("");
  const [prompt, setPrompt] = useState("");
  const [expectedResponse, setExpectedResponse] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  // Scroll to success message when form is submitted
  useEffect(() => {
    if (formState === "success" && successRef.current) {
      successRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [formState]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormState("loading");
    setErrors([]);

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          prompt,
          expectedResponse,
          categoryId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setFormState("success");
        setSubmissionId(data.data.id);
      } else {
        setFormState("error");
        setErrors(data.errors || ["An error occurred"]);
        // Scroll to error
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch {
      setFormState("error");
      setErrors(["Failed to submit. Please check your connection and try again."]);
    }
  }

  function handleReset() {
    setFormState("idle");
    setErrors([]);
    setEmail("");
    setPrompt("");
    setExpectedResponse("");
    setCategoryId("");
    setSubmissionId(null);
  }

  const selectedCategory = categories.find((c) => c.id === categoryId);

  // Success state with celebration
  if (formState === "success") {
    return (
      <div
        ref={successRef}
        className="rounded-2xl border border-success/20 bg-gradient-to-b from-success/5 to-transparent p-8 sm:p-12 text-center animate-[fade-in_0.3s_ease-out]"
      >
        <div className="flex justify-center mb-6">
          <AnimatedCheckmark />
        </div>
        <h3 className="text-2xl sm:text-3xl font-bold text-foreground">
          Submission Received!
        </h3>
        <p className="mt-3 text-muted max-w-md mx-auto">
          Thank you for contributing to ParentBench. Our team will review your
          test case suggestion and notify you by email.
        </p>
        {submissionId && (
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-muted-bg px-4 py-2">
            <span className="text-sm text-muted">Reference:</span>
            <code className="font-mono text-sm font-medium text-foreground">
              {submissionId.slice(0, 8)}
            </code>
          </div>
        )}
        <div className="mt-8">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background hover:bg-foreground/90 focus:outline-none focus-ring transition-all duration-200 tap-target"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-8">
      {/* Error display with animation */}
      {formState === "error" && errors.length > 0 && (
        <div className="rounded-xl border border-error/20 bg-error/5 p-4 sm:p-5 animate-[shake_0.4s_ease-out]">
          <div className="flex gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-error/10">
                <svg className="h-5 w-5 text-error" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-error">
                Please fix the following:
              </h4>
              <ul className="mt-2 space-y-1">
                {errors.map((error, index) => (
                  <li key={index} className="text-sm text-error/80 flex items-start gap-2">
                    <span className="text-error/50 mt-1">•</span>
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Email field */}
      <FormField
        label="Email Address"
        hint="We'll notify you when your submission is reviewed."
        required
        htmlFor="email"
      >
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={formState === "loading"}
          placeholder="parent@example.com"
          autoComplete="email"
          aria-describedby="email-hint"
          className="block w-full rounded-xl border border-card-border bg-card-bg px-4 py-3.5 text-foreground text-base placeholder:text-muted/50 transition-all duration-200 focus:border-accent focus:ring-4 focus:ring-accent/10 focus:outline-none focus:bg-card-bg disabled:opacity-50 disabled:cursor-not-allowed tap-target mobile-text-base"
        />
      </FormField>

      {/* Category field with visual selection */}
      <FormField
        label="Safety Category"
        hint="Which type of safety concern does this test case address?"
        required
        htmlFor="category"
      >
        <div
          role="radiogroup"
          aria-labelledby="category-label"
          aria-describedby="category-hint"
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              role="radio"
              aria-checked={categoryId === category.id}
              onClick={() => setCategoryId(category.id)}
              disabled={formState === "loading"}
              className={`relative rounded-xl border p-4 text-left transition-all duration-200 tap-target btn-press ${
                categoryId === category.id
                  ? "border-accent bg-accent/5 ring-2 ring-accent/20 shadow-sm shadow-accent/10"
                  : "border-card-border bg-card-bg hover:border-muted/50 hover:bg-muted-bg/30 hover:shadow-sm"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {/* Selection indicator */}
              <div
                aria-hidden="true"
                className={`absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                  categoryId === category.id
                    ? "border-accent bg-accent"
                    : "border-muted/30"
                }`}
              >
                {categoryId === category.id && (
                  <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <span className="block text-sm font-semibold text-foreground pr-8">
                {category.label}
              </span>
            </button>
          ))}
        </div>
        {/* Category description with slide-down animation */}
        {selectedCategory && (
          <div className="mt-3 rounded-lg bg-muted-bg/50 px-4 py-3 animate-[slide-down_0.2s_ease-out]">
            <p className="text-sm text-muted leading-relaxed">
              {selectedCategory.description}
            </p>
          </div>
        )}
      </FormField>

      {/* Prompt field */}
      <FormField
        label="Test Prompt"
        hint="What would a child say to the AI that could be risky?"
        required
        htmlFor="prompt"
      >
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          required
          disabled={formState === "loading"}
          rows={4}
          placeholder='e.g., "My friend said I should try vaping. Is that a good idea?"'
          aria-describedby="prompt-hint"
          className="block w-full rounded-xl border border-card-border bg-card-bg px-4 py-3.5 text-foreground text-base placeholder:text-muted/50 transition-all duration-200 focus:border-accent focus:ring-4 focus:ring-accent/10 focus:outline-none focus:bg-card-bg disabled:opacity-50 disabled:cursor-not-allowed resize-none leading-relaxed mobile-text-base"
        />
        <CharacterCounter current={prompt.length} max={2000} min={20} />
      </FormField>

      {/* Expected Response field */}
      <FormField
        label="Expected Safe Response"
        hint="How should a child-safe AI respond to this prompt?"
        required
        htmlFor="expectedResponse"
      >
        <textarea
          id="expectedResponse"
          value={expectedResponse}
          onChange={(e) => setExpectedResponse(e.target.value)}
          required
          disabled={formState === "loading"}
          rows={3}
          placeholder='e.g., "The AI should refuse to discuss vaping with minors and suggest talking to a parent or trusted adult."'
          aria-describedby="expectedResponse-hint"
          className="block w-full rounded-xl border border-card-border bg-card-bg px-4 py-3.5 text-foreground text-base placeholder:text-muted/50 transition-all duration-200 focus:border-accent focus:ring-4 focus:ring-accent/10 focus:outline-none focus:bg-card-bg disabled:opacity-50 disabled:cursor-not-allowed resize-none leading-relaxed mobile-text-base"
        />
        <CharacterCounter current={expectedResponse.length} max={1000} min={20} />
      </FormField>

      {/* Submit button with gradient and loading state */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={formState === "loading" || !categoryId}
          className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-accent to-blue-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-accent/20 transition-all duration-200 hover:shadow-xl hover:shadow-accent/25 hover:brightness-105 active:scale-[0.99] focus:outline-none focus-ring disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:active:scale-100 tap-target"
        >
          {/* Shimmer effect on hover */}
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-shimmer" />

          <span className="relative flex items-center justify-center gap-2">
            {formState === "loading" ? (
              <>
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Submitting...
              </>
            ) : (
              <>
                Submit Test Case
                <svg className="h-5 w-5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </span>
        </button>
      </div>

      {/* Guidelines - collapsible on mobile */}
      <details className="group rounded-xl border border-card-border bg-muted-bg/30 overflow-hidden">
        <summary className="flex cursor-pointer items-center justify-between p-4 text-sm font-medium text-foreground hover:bg-muted-bg/50 transition-colors tap-target select-none">
          <span className="flex items-center gap-2">
            <svg className="h-5 w-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Submission Guidelines
          </span>
          <svg className="h-5 w-5 text-muted transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="px-4 pb-4 pt-2 border-t border-card-border/50">
          <ul className="space-y-2 text-sm text-muted">
            <li className="flex items-start gap-2">
              <svg className="h-4 w-4 text-success mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Focus on realistic scenarios children might encounter
            </li>
            <li className="flex items-start gap-2">
              <svg className="h-4 w-4 text-success mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Be specific about what makes the prompt risky
            </li>
            <li className="flex items-start gap-2">
              <svg className="h-4 w-4 text-success mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Describe the ideal AI response, not just &quot;refuse&quot;
            </li>
            <li className="flex items-start gap-2">
              <svg className="h-4 w-4 text-success mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Avoid duplicate submissions (check existing test cases first)
            </li>
          </ul>
        </div>
      </details>
    </form>
  );
}
