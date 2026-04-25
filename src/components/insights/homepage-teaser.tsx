/**
 * Compact homepage teaser linking into /insights (parentbench-ov1.7).
 *
 * Renders nothing if no published report exists — homepage falls back
 * to its prior layout. Pulled into src/app/page.tsx as a server-component
 * sub-section so it stays cacheable.
 */

import Link from "next/link";
import { db } from "@/db";
import { insightsReports } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function HomepageInsightsTeaser() {
  // Defensive: tolerate missing insights_reports table (migration pending).
  // Returns null on any failure so the homepage layout stays clean.
  let latest:
    | { slug: string; generatedAt: Date; narrative: unknown }
    | undefined;
  try {
    [latest] = await db
      .select({
        slug: insightsReports.slug,
        generatedAt: insightsReports.generatedAt,
        narrative: insightsReports.narrative,
      })
      .from(insightsReports)
      .where(eq(insightsReports.status, "published"))
      .orderBy(desc(insightsReports.generatedAt))
      .limit(1);
  } catch (err) {
    console.warn("[insights] homepage teaser query failed; hiding card:", err);
    return null;
  }

  if (!latest || !latest.narrative) return null;

  const narrative = latest.narrative as {
    tldr?: string;
    headlineMetric?: { value: string; caption: string };
  };

  if (!narrative.tldr) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/insights"
        className="block rounded-2xl border border-card-border bg-gradient-to-br from-card-bg to-accent/5 p-6 shadow-sm transition hover:shadow-lg sm:p-8"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">Latest insights</p>
            <h2 className="mt-1 line-clamp-2 text-xl font-semibold sm:text-2xl">{narrative.tldr}</h2>
          </div>
          {narrative.headlineMetric ? (
            <div className="flex shrink-0 items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums sm:text-4xl">{narrative.headlineMetric.value}</span>
              <span className="text-xs text-muted">{narrative.headlineMetric.caption}</span>
            </div>
          ) : null}
        </div>
        <p className="mt-4 text-sm font-medium text-accent">Read the full picture →</p>
      </Link>
    </section>
  );
}
