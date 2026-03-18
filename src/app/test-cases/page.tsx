import type { Metadata } from "next";
import Link from "next/link";
import { getParentBenchTestCases, getParentBenchMethodology } from "@/lib/parentbench";
import { PARENTBENCH_CATEGORY_META, PARENTBENCH_CATEGORY_ORDER } from "@/lib/constants";
import type { ParentBenchCategory } from "@/types/parentbench";

export const metadata: Metadata = {
  title: "Test Cases",
  description: "Browse every ParentBench test case with severity, prompts, and example AI responses.",
};

const severityColors = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
};

const behaviorLabels = {
  refuse: "Should Refuse",
  safe_response: "Safe Response Expected",
  redirect: "Should Redirect",
};

export default async function TestCasesPage() {
  const [testCases, methodology] = await Promise.all([getParentBenchTestCases(), getParentBenchMethodology()]);
  const grouped = PARENTBENCH_CATEGORY_ORDER.reduce((acc, category) => {
    acc[category] = testCases.filter((testCase) => testCase.category === category);
    return acc;
  }, {} as Record<ParentBenchCategory, typeof testCases>);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8">
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-foreground"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to leaderboard
        </Link>
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">ParentBench test cases</h1>
        <p className="mt-3 text-muted">
          {testCases.length} prompts across {PARENTBENCH_CATEGORY_ORDER.length} categories. Use them to validate our results,
          reproduce an issue, or stress-test models you deploy to families.
        </p>
      </div>

      {PARENTBENCH_CATEGORY_ORDER.map((category) => {
        const meta = PARENTBENCH_CATEGORY_META[category];
        const count = methodology.testCaseCounts[category];
        return (
          <section key={category} className="mb-12">
            <div className="sticky top-16 z-10 bg-background/95 backdrop-blur py-4">
              <h2 className="text-2xl font-semibold">{meta.label}</h2>
              <p className="text-sm text-muted">{meta.description}</p>
              <p className="text-xs text-muted">{count} test cases</p>
            </div>

            <div className="space-y-4">
              {grouped[category].map((testCase) => (
                <article key={testCase.id} className="rounded-xl border border-card-border bg-card-bg shadow-sm">
                  <div className="border-b border-card-border bg-muted-bg/30 p-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                      <span className={`rounded-full px-2 py-0.5 ${severityColors[testCase.severity]}`}>{testCase.severity}</span>
                      <span className="text-muted">{behaviorLabels[testCase.expectedBehavior]}</span>
                      <span className="text-muted">#{testCase.id}</span>
                    </div>
                    <p className="mt-3 font-medium">“{testCase.prompt}”</p>
                    <p className="mt-1 text-sm text-muted">{testCase.description}</p>
                  </div>

                  {testCase.examples?.length ? (
                    <div className="divide-y divide-card-border">
                      {testCase.examples.map((example, index) => (
                        <div key={index} className="p-4">
                          <div className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
                            {example.type === "good" ? (
                              <span className="text-green-700 dark:text-green-400">Good response</span>
                            ) : (
                              <span className="text-red-700 dark:text-red-400">Bad response</span>
                            )}
                          </div>
                          <div
                            className={`mt-2 rounded-lg border p-3 text-sm ${
                              example.type === "good"
                                ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                                : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                            }`}
                          >
                            “{example.response}”
                          </div>
                          <p className="mt-2 text-xs text-muted">{example.explanation}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-sm text-muted">Examples coming soon.</div>
                  )}
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
