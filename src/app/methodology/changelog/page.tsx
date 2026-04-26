/**
 * /methodology/changelog — methodology version history
 * (parentbench-rg1.3).
 *
 * Renders the changelog array from data/parentbench/methodology.json,
 * newest-first. Each entry shows version pill, date, and a summary
 * paragraph.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { getParentBenchMethodology } from "@/lib/parentbench";
import { sortChangelogDesc, getCurrentVersion, type ChangelogEntry } from "@/lib/methodology/changelog";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Methodology changelog",
  description:
    "Version history of ParentBench scoring methodology. Each version is dated and explained.",
};

export default async function MethodologyChangelogPage() {
  const methodology = await getParentBenchMethodology();
  const entries: ChangelogEntry[] = methodology.changelog ?? [];
  const sorted = sortChangelogDesc(entries);
  const current = getCurrentVersion(methodology);

  return (
    <main>
      <section className="border-b border-card-border bg-card-bg/30">
        <div className="mx-auto max-w-4xl px-4 py-12">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">
            <Link href="/methodology" className="hover:underline">Methodology</Link>
            <span className="mx-2 text-muted">/</span>
            Changelog
          </p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Methodology changelog</h1>
          <p className="mt-3 max-w-2xl text-muted">
            Every change to how ParentBench computes scores is recorded here. The
            current methodology version is{" "}
            <strong className="text-foreground">v{current}</strong>. Older scores in
            our archive were computed under earlier versions; we keep the history
            so the comparison stays honest.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-12">
        {sorted.length === 0 ? (
          <div className="rounded-lg border border-dashed border-card-border p-8 text-center text-muted">
            No changelog entries yet.
          </div>
        ) : (
          <ol className="space-y-8 border-l border-card-border pl-6">
            {sorted.map((entry, i) => (
              <li key={`${entry.version}-${entry.date}-${i}`} className="relative">
                <span
                  aria-hidden
                  className="absolute -left-[1.875rem] top-1 h-3 w-3 rounded-full border-2 border-card-border bg-background"
                />
                <header className="mb-2 flex flex-wrap items-baseline gap-2">
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                    v{entry.version}
                  </span>
                  <time className="text-sm text-muted" dateTime={entry.date}>
                    {new Date(entry.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </time>
                  {entry.version === current ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                      current
                    </span>
                  ) : null}
                </header>
                <p className="text-sm leading-relaxed text-foreground">{entry.summary}</p>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-12 rounded-lg border border-card-border bg-card-bg/40 p-5 text-sm">
          <p className="mb-2 font-semibold">Why we keep this log</p>
          <p className="text-muted">
            Safety benchmarks lose credibility when scoring rules change without
            notice. Surfacing every methodology change lets researchers and parents
            compare results across versions. Each score on the leaderboard is
            stamped with the methodology version under which it was computed.
          </p>
        </div>
      </section>
    </main>
  );
}
