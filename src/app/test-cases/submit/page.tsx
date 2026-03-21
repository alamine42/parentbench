import type { Metadata } from "next";
import Link from "next/link";
import { getAllCategories } from "@/db/queries/submissions";
import { SubmissionForm } from "@/components/submissions/submission-form";

export const metadata: Metadata = {
  title: "Submit a Test Case | ParentBench",
  description:
    "Suggest a new test case for ParentBench. Help us evaluate AI safety for children by contributing scenarios that matter to parents.",
};

export default async function SubmitTestCasePage() {
  const categories = await getAllCategories();

  return (
    <div className="min-h-screen">
      {/* Hero gradient background */}
      <div className="absolute inset-x-0 top-0 h-[400px] bg-gradient-to-b from-accent/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative mx-auto max-w-2xl px-4 py-8 sm:py-12 md:py-16">
        {/* Back link with hover animation */}
        <div className="mb-8 sm:mb-10">
          <Link
            href="/test-cases"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground transition-colors tap-target"
          >
            <svg
              className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to test cases
          </Link>
        </div>

        {/* Header with badge */}
        <div className="mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent mb-4">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zm0 16a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
            Community Contribution
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            Suggest a Test Case
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-muted leading-relaxed max-w-xl">
            Help make AI safer for children. Submit a scenario that you think
            should be part of our safety evaluation.
          </p>
        </div>

        {/* Process steps - horizontal on desktop, vertical on mobile */}
        <div className="mb-8 sm:mb-10 rounded-2xl border border-card-border bg-card-bg p-5 sm:p-6 elevation-2">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            How it works
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {[
              {
                step: "1",
                title: "Submit",
                description: "Describe a scenario that tests AI safety",
              },
              {
                step: "2",
                title: "Review",
                description: "Our team evaluates your submission",
              },
              {
                step: "3",
                title: "Impact",
                description: "Approved cases help rate AI models",
              },
            ].map((item, index) => (
              <div key={item.step} className="relative flex sm:flex-col items-start sm:items-center gap-4 sm:gap-3 sm:text-center">
                {/* Connector line for desktop */}
                {index < 2 && (
                  <div className="hidden sm:block absolute top-5 left-1/2 w-full h-px bg-gradient-to-r from-card-border to-card-border/0" />
                )}
                {/* Step number */}
                <div className="relative flex h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-blue-600 text-white font-bold text-sm sm:text-base shadow-lg shadow-accent/20">
                  {item.step}
                </div>
                <div className="sm:mt-2">
                  <p className="font-semibold text-foreground text-sm sm:text-base">
                    {item.title}
                  </p>
                  <p className="text-sm text-muted mt-0.5">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-card-border bg-card-bg elevation-3 overflow-hidden">
          {/* Form header */}
          <div className="border-b border-card-border bg-muted-bg/30 px-6 py-4 sm:px-8 sm:py-5">
            <h2 className="text-lg font-semibold text-foreground">
              Test Case Details
            </h2>
            <p className="text-sm text-muted mt-0.5">
              All fields marked with * are required
            </p>
          </div>
          {/* Form body */}
          <div className="p-6 sm:p-8">
            <SubmissionForm categories={categories} />
          </div>
        </div>

        {/* Privacy note with icon */}
        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted">
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p>
            Your email is only used for notifications.{" "}
            <Link
              href="/privacy"
              className="font-medium text-accent hover:underline"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
