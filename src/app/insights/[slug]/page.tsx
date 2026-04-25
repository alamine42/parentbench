/**
 * /insights/[slug] — historical insights report (parentbench-ov1.6).
 *
 * Returns 404 for slugs that don't exist or whose status is anything
 * other than `published`.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { insightsReports, models } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { InsightsAggregate } from "@/lib/insights/build-aggregate";
import type { InsightsNarrative } from "@/lib/insights/writer-model";
import { ProviderRollupChart } from "@/components/insights/provider-rollup-chart";
import { CategoryLeadersChart } from "@/components/insights/category-leaders-chart";
import { BiggestMoversChart } from "@/components/insights/biggest-movers-chart";
import { SpreadChart } from "@/components/insights/spread-chart";
import { CalloutCards } from "@/components/insights/callout-cards";
import { NarrativeSections } from "@/components/insights/narrative-section";
import { formatDate } from "@/lib/utils";

export const revalidate = 60;

export default async function InsightsArchivePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [row] = await db
    .select()
    .from(insightsReports)
    .where(eq(insightsReports.slug, slug))
    .limit(1);

  if (!row || row.status !== "published" || !row.narrative) {
    notFound();
  }

  const aggregate = row.aggregates as unknown as InsightsAggregate;
  const narrative = row.narrative as unknown as InsightsNarrative;

  const modelRows = await db.select({ slug: models.slug, name: models.name }).from(models);
  const modelNames: Record<string, string> = Object.fromEntries(modelRows.map((m) => [m.slug, m.name]));

  const charts = {
    "provider-rollup": <ProviderRollupChart providers={aggregate.providers} />,
    "category-leaders": <CategoryLeadersChart leaders={aggregate.categoryLeaders} />,
    "biggest-movers": <BiggestMoversChart movers={aggregate.biggestMovers} />,
    "spread": <SpreadChart spread={aggregate.spread} modelNames={modelNames} />,
  } as const;

  return (
    <main>
      <section className="border-b border-card-border bg-card-bg/30">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">
            <Link href="/insights" className="hover:underline">Insights</Link>
            <span className="mx-2 text-muted">/</span>
            {slug}
          </p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Insights — {formatDate(row.dataThrough.toISOString())}</h1>
          <p className="mt-2 max-w-2xl text-muted">{narrative.tldr}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
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
          <p className="mb-2 font-semibold uppercase tracking-wide">Methodology</p>
          <p>{narrative.methodologyNote}</p>
          <p className="mt-2">Written by <span className="font-medium">{row.generatorModel}</span>.</p>
        </footer>
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
