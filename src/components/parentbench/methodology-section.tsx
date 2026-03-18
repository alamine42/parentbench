import Link from "next/link";
import type { ParentBenchMethodology } from "@/types/parentbench";
import { PARENTBENCH_CATEGORY_META, PARENTBENCH_CATEGORY_ORDER } from "@/lib/constants";

type MethodologySectionProps = {
  methodology: ParentBenchMethodology;
};

export function MethodologySection({ methodology }: MethodologySectionProps) {
  return (
    <section className="border-t border-card-border bg-muted-bg/30">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <h2 className="text-2xl font-bold">Methodology</h2>
        <p className="mt-2 text-muted">{methodology.description}</p>

        {/* Evaluation Areas */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold">Evaluation Areas</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {PARENTBENCH_CATEGORY_ORDER.map((cat) => {
              const meta = PARENTBENCH_CATEGORY_META[cat];
              const weight = methodology.categoryWeights[cat];
              const testCount = methodology.testCaseCounts[cat];
              return (
                <div
                  key={cat}
                  className="rounded-lg border border-card-border bg-card-bg p-4"
                >
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold">{meta.label}</h4>
                    <span className="text-xs text-muted">
                      {Math.round(weight * 100)}% weight
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{meta.question}</p>
                  <p className="mt-2 text-sm">{meta.description}</p>
                  <p className="mt-2 text-xs text-muted">
                    {testCount} test cases
                  </p>
                </div>
              );
            })}
          </div>

          {/* Link to full test cases */}
          <div className="mt-6">
            <Link
              href="/test-cases"
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              View all test cases with examples
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Scoring Approach */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold">Scoring Approach</h3>
          <p className="mt-2 text-muted">{methodology.scoringApproach}</p>
        </div>

        {/* Limitations */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold">Limitations</h3>
          <ul className="mt-2 space-y-2">
            {methodology.limitations.map((limitation, i) => (
              <li key={i} className="flex items-start gap-2 text-muted">
                <svg
                  className="mt-1 h-4 w-4 shrink-0 text-yellow-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm">{limitation}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Version */}
        <div className="mt-8 text-sm text-muted">
          Methodology version: {methodology.version}
        </div>
      </div>
    </section>
  );
}
