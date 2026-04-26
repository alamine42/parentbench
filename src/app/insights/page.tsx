/**
 * /insights — public insights & overview page (parentbench-ov1.5, ov1.6).
 *
 * Renders the latest *published* insights report. Falls back to the
 * prior published if the latest is in any non-published state. Returns
 * 404 if no published report exists.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { insightsReports, models } from "@/db/schema";
import type { InsightsAggregate } from "@/lib/insights/build-aggregate";
import type { InsightsNarrative } from "@/lib/insights/writer-model";
import { pickPublishedForInsightsRoute } from "@/lib/insights/pick-report";
import { ProviderRollupChart } from "@/components/insights/provider-rollup-chart";
import { CategoryLeadersChart } from "@/components/insights/category-leaders-chart";
import { BiggestMoversChart } from "@/components/insights/biggest-movers-chart";
import { SpreadChart } from "@/components/insights/spread-chart";
import { CalloutCards } from "@/components/insights/callout-cards";
import { NarrativeSections } from "@/components/insights/narrative-section";
import { formatDate } from "@/lib/utils";
import { MethodologyVersionPill } from "@/components/parentbench/methodology-version-pill";
import { getParentBenchMethodology } from "@/lib/parentbench";

export const revalidate = 60;
export const metadata = {
  title: "The State of Child-Safe AI — ParentBench",
  description:
    "A clear, parent-friendly look at how AI models compare on child safety. Updated automatically as new evaluations come in.",
};

export default async function InsightsPage() {
  // Defensive: the insights_reports table may not exist yet (migration
  // pending) — treat any DB failure as "no published report" so the build
  // and the rest of the site stay green.
  let rows: Array<{
    id: string;
    slug: string;
    status: "draft" | "generation_failed" | "published" | "retracted";
    generatedAt: Date;
    dataThrough: Date;
    aggregates: unknown;
    narrative: unknown;
    generatorModel: string;
  }> = [];
  try {
    rows = await db
      .select({
        id: insightsReports.id,
        slug: insightsReports.slug,
        status: insightsReports.status,
        generatedAt: insightsReports.generatedAt,
        dataThrough: insightsReports.dataThrough,
        aggregates: insightsReports.aggregates,
        narrative: insightsReports.narrative,
        generatorModel: insightsReports.generatorModel,
      })
      .from(insightsReports);
  } catch (err) {
    console.warn("[insights] insights_reports query failed; treating as no data:", err);
  }

  const picked = pickPublishedForInsightsRoute(rows);
  if (!picked || !picked.narrative) {
    notFound();
  }

  const aggregate = picked.aggregates as unknown as InsightsAggregate;
  const narrative = picked.narrative as unknown as InsightsNarrative;
  const methodology = await getParentBenchMethodology();

  // Resolve model names for chart labels
  const modelRows = await db.select({ slug: models.slug, name: models.name }).from(models);
  const modelNames: Record<string, string> = Object.fromEntries(modelRows.map((m) => [m.slug, m.name]));

  const charts = {
    "provider-rollup": <ProviderRollupChart providers={aggregate.providers} />,
    "category-leaders": <CategoryLeadersChart leaders={aggregate.categoryLeaders} />,
    "biggest-movers": <BiggestMoversChart movers={aggregate.biggestMovers} />,
    "spread": <SpreadChart spread={aggregate.spread} modelNames={modelNames} />,
  } as const;

  const ageInDays = Math.floor((Date.now() - new Date(picked.dataThrough).getTime()) / (1000 * 60 * 60 * 24));
  const isStale = ageInDays > 14;

  return (
    <main>
      <section className="border-b border-card-border bg-card-bg/30">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">Insights</p>
              <h1 className="text-4xl font-bold sm:text-5xl">The State of Child-Safe AI</h1>
              <p className="mt-2 max-w-2xl text-muted">
                Here&apos;s what the latest ParentBench evaluations tell us about how AI models
                compare for kids — written in plain language for parents.
              </p>
            </div>
            <div className="text-right text-xs text-muted">
              <p>Updated {formatDate(picked.generatedAt.toISOString())}</p>
              <p>Data through {formatDate(picked.dataThrough.toISOString())}</p>
            </div>
          </div>
          {isStale ? (
            <div className="mt-4 rounded-lg border border-amber-300/40 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
              ⚠️ This report is more than two weeks old. Data may be out of date.
            </div>
          ) : null}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="rounded-2xl border border-card-border bg-card-bg p-6 shadow-sm sm:p-8">
          <p className="text-base leading-relaxed sm:text-lg">{narrative.tldr}</p>
          <div className="mt-6 flex items-baseline gap-3">
            <span className="text-4xl font-bold tabular-nums sm:text-5xl">{narrative.headlineMetric.value}</span>
            <span className="text-sm text-muted">{narrative.headlineMetric.caption}</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12">
        <h2 className="mb-6 text-2xl font-bold">At a glance</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <ChartPanel title="Provider averages">
            <ProviderRollupChart providers={aggregate.providers} />
          </ChartPanel>
          <ChartPanel title="Category leaders">
            <CategoryLeadersChart leaders={aggregate.categoryLeaders} />
          </ChartPanel>
          <ChartPanel title="Biggest movers (30 days)">
            <BiggestMoversChart movers={aggregate.biggestMovers} />
          </ChartPanel>
          <ChartPanel title="Score spread">
            <SpreadChart spread={aggregate.spread} modelNames={modelNames} />
          </ChartPanel>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12">
        <h2 className="mb-6 text-2xl font-bold">Highlights</h2>
        <CalloutCards
          callouts={narrative.callouts}
          hasMovers={aggregate.biggestMovers.length > 0}
          hasNewcomers={aggregate.newcomers.length > 0}
          hasRegressions={aggregate.regressionWatch.length > 0}
        />
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <NarrativeSections sections={narrative.sections} charts={charts} />
        <footer className="mt-12 max-w-3xl rounded-lg border border-card-border bg-card-bg/40 p-5 text-sm text-muted">
          <div className="mb-2 flex items-center gap-2">
            <p className="font-semibold uppercase tracking-wide">Methodology</p>
            <MethodologyVersionPill version={methodology.version} />
          </div>
          <p>{narrative.methodologyNote}</p>
          <p className="mt-2">
            Written by <span className="font-medium">{picked.generatorModel}</span>. Every number
            in this analysis is programmatically validated against the source data.
            See the full <Link className="underline" href="/methodology">scoring methodology</Link>.
          </p>
        </footer>
      </section>

      <section className="border-t border-card-border bg-card-bg/30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 text-sm">
          <span className="text-muted">Past reports are kept in the archive.</span>
          <Link href="/insights/archive" className="font-medium text-accent underline">
            See archive →
          </Link>
        </div>
      </section>
    </main>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-card-border bg-card-bg p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </div>
  );
}
