import Link from "next/link";
import Image from "next/image";
import { HeroSection } from "@/components/parentbench/hero-section";
import { HomepageInsightsTeaser } from "@/components/insights/homepage-teaser";
import { NewsletterSignup, NEWSLETTER_ENABLED } from "@/components/newsletter-signup";
import { LetterGradeBadge } from "@/components/ui/letter-grade";
import { ScoreRing } from "@/components/ui/score-ring";
import { ColorBar } from "@/components/ui/color-bar";
import { getParentBenchScores, getParentBenchMethodology, getParentBenchModelCount, getParentBenchLastUpdated } from "@/lib/parentbench";
import { getAllModels } from "@/lib/data";
import { formatDate } from "@/lib/utils";
import { PARENTBENCH_CATEGORY_META } from "@/lib/constants";
import type { ParentBenchCategory } from "@/types/parentbench";

export const revalidate = 60;

export default async function HomePage() {
  const [scores, methodology, modelCount, lastUpdated, models] = await Promise.all([
    getParentBenchScores(),
    getParentBenchMethodology(),
    getParentBenchModelCount(),
    getParentBenchLastUpdated(),
    getAllModels(),
  ]);

  const modelMap = new Map(models.map((model) => [model.slug, model]));
  const testCaseCount = Object.values(methodology.testCaseCounts).reduce((total, count) => total + count, 0);
  const topScores = scores.slice(0, 3).map((score) => {
    const modelInfo = modelMap.get(score.modelSlug);
    return {
      ...score,
      provider: modelInfo?.provider,
      modelName: modelInfo?.name ?? score.modelSlug,
    };
  });

  return (
    <div>
      <HeroSection modelCount={modelCount} testCaseCount={testCaseCount} lastUpdated={lastUpdated} />

      <HomepageInsightsTeaser />

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col gap-4 text-center sm:text-left">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">Top Models Right Now</p>
          <h2 className="text-3xl font-bold">The most helpful & safe AI models for kids</h2>
          <p className="text-muted">
            Ranked by overall safety — how reliably each model handles risky prompts from kids and teens.
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {topScores.map((score, index) => (
            <article
              key={score.modelSlug}
              className="rounded-2xl border border-card-border bg-card-bg p-5 shadow-sm transition hover:shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {score.provider?.logo && (
                    <Image
                      src={score.provider.logo}
                      alt={score.provider.name}
                      width={40}
                      height={40}
                      className="rounded-lg shrink-0"
                    />
                  )}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">#{index + 1}</p>
                    <h3 className="text-lg font-semibold">{score.modelName}</h3>
                    <p className="text-sm text-muted">{score.provider?.name ?? "Unknown provider"}</p>
                  </div>
                </div>
                <LetterGradeBadge grade={score.overallGrade} size="sm" />
              </div>
              <div className="mt-4 flex items-center justify-center">
                <ScoreRing score={score.overallScore} size="md" showGrade />
              </div>
              <p className="mt-4 text-sm text-muted">
                Evaluated {formatDate(score.evaluatedDate)} · Trend {score.trend.toUpperCase()}
              </p>
              <Link
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                href={`/model/${score.modelSlug}`}
              >
                View full report
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M11.78 5.22a.75.75 0 010 1.06L8.81 9.25H15a.75.75 0 010 1.5H8.81l2.97 2.97a.75.75 0 11-1.06 1.06l-4.25-4.25a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Browse the full leaderboard
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10.293 3.293a1 1 0 011.414 0l5 5a1 1 0 01-.023 1.415l-5 4.9a1 1 0 01-1.378-1.45l3.167-3.106H4a1 1 0 110-2h9.473L10.293 4.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
        </div>
      </section>

      <section className="border-t border-card-border bg-card-bg/50 py-12">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">The Four Areas We Test</p>
              <h2 className="mt-2 text-3xl font-bold">Not all “safe mode” switches are equal.</h2>
              <p className="mt-4 text-muted">
                ParentBench is built from real prompts kids use. Every category includes critical, high, and medium severity test
                cases so we can see how models behave when pushed.
              </p>
              <Link
                href="/methodology"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Explore the full methodology
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M11.78 5.22a.75.75 0 010 1.06L8.81 9.25H15a.75.75 0 010 1.5H8.81l2.97 2.97a.75.75 0 11-1.06 1.06l-4.25-4.25a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </Link>
            </div>
            <div className="space-y-4 rounded-2xl border border-card-border bg-card-bg p-6">
              {Object.entries(methodology.categoryWeights).map(([category, weight]) => {
                const meta = PARENTBENCH_CATEGORY_META[category as ParentBenchCategory];
                return (
                  <div key={category} className="rounded-lg border border-card-border/70 p-4">
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>{meta.label}</span>
                      <span>{Math.round(weight * 100)}% weight</span>
                    </div>
                    <p className="mt-1 text-xs text-muted">{meta.question}</p>
                    <div className="mt-3">
                      <ColorBar score={weight * 100} height="sm" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter section - hidden until feature is enabled (parentbench-ffa.11) */}
      {NEWSLETTER_ENABLED && (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-8 rounded-2xl border border-card-border bg-card-bg p-8 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">Stay in the loop</p>
              <h2 className="mt-2 text-3xl font-bold">Get new safety grades in your inbox.</h2>
              <p className="mt-2 text-muted">
                We only email when we publish new model evaluations, release methodology updates, or open-source new test cases.
              </p>
            </div>
            <div>
              <NewsletterSignup variant="compact" />
              <p className="mt-2 text-xs text-muted">Zero spam. Unsubscribe anytime.</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
