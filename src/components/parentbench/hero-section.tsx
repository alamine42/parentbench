import { formatDate } from "@/lib/utils";

type HeroSectionProps = {
  modelCount: number;
  testCaseCount: number;
  lastUpdated: string;
};

export function HeroSection({
  modelCount,
  testCaseCount,
  lastUpdated,
}: HeroSectionProps) {
  return (
    <section className="border-b border-card-border bg-gradient-to-b from-blue-50/50 to-background dark:from-blue-950/20 dark:to-background">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
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
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Child Safety Benchmark
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Is This AI Safe for{" "}
            <span className="text-blue-600 dark:text-blue-400">Your Kids</span>?
          </h1>
          <p className="mt-4 text-lg text-muted">
            ParentBench evaluates AI models on safety for children under 16.
            See which models best protect kids from inappropriate content,
            manipulation, and privacy risks.
          </p>

          {/* Stats */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground sm:text-3xl">
                {modelCount}
              </div>
              <div className="text-sm text-muted">Models Tested</div>
            </div>
            <div className="h-8 w-px bg-card-border" />
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground sm:text-3xl">
                {testCaseCount}
              </div>
              <div className="text-sm text-muted">Test Cases</div>
            </div>
            <div className="h-8 w-px bg-card-border" />
            <div className="text-center">
              <div className="text-sm font-medium text-foreground">
                {formatDate(lastUpdated)}
              </div>
              <div className="text-sm text-muted">Last Updated</div>
            </div>
          </div>

          {/* Preview Data Notice */}
          <div className="mt-8 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-900/20">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Preview:</strong> These scores are illustrative examples for demonstration purposes.
              Actual model evaluations are coming soon.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
