/**
 * /insights/archive — paginated index of past published reports
 * (parentbench-ov1.6).
 */

import Link from "next/link";
import { db } from "@/db";
import { insightsReports } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { formatDate } from "@/lib/utils";

export const revalidate = 60;
export const metadata = {
  title: "Insights archive — ParentBench",
};

const PAGE_SIZE = 10;

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));

  // Defensive: tolerate missing insights_reports table (migration pending).
  let rows: Array<{
    slug: string;
    generatedAt: Date;
    dataThrough: Date;
    narrative: unknown;
    generatorModel: string;
  }> = [];
  try {
    rows = await db
      .select({
        slug: insightsReports.slug,
        generatedAt: insightsReports.generatedAt,
        dataThrough: insightsReports.dataThrough,
        narrative: insightsReports.narrative,
        generatorModel: insightsReports.generatorModel,
      })
      .from(insightsReports)
      .where(eq(insightsReports.status, "published"))
      .orderBy(desc(insightsReports.generatedAt))
      .limit(PAGE_SIZE + 1) // +1 to detect "has next page"
      .offset((page - 1) * PAGE_SIZE);
  } catch (err) {
    console.warn("[insights] insights_reports query failed; empty archive:", err);
  }

  const hasNext = rows.length > PAGE_SIZE;
  const visible = rows.slice(0, PAGE_SIZE);

  return (
    <main>
      <section className="border-b border-card-border bg-card-bg/30">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">
            <Link href="/insights" className="hover:underline">Insights</Link>
            <span className="mx-2">/</span>
            Archive
          </p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Past reports</h1>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        {visible.length === 0 ? (
          <div className="rounded-lg border border-dashed border-card-border p-8 text-center text-muted">
            No published reports yet.
          </div>
        ) : (
          <ul className="divide-y divide-card-border rounded-2xl border border-card-border bg-card-bg">
            {visible.map((r) => {
              const tldr = (r.narrative as { tldr?: string } | null)?.tldr ?? "";
              return (
                <li key={r.slug}>
                  <Link href={`/insights/${r.slug}`} className="block p-5 hover:bg-muted-bg">
                    <div className="flex items-baseline justify-between gap-4">
                      <h2 className="text-lg font-semibold">Insights — {formatDate(r.dataThrough.toISOString())}</h2>
                      <span className="text-xs text-muted">{r.slug}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-muted">{tldr}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={`/insights/archive?page=${page - 1}`} className="text-accent underline">
              ← Newer
            </Link>
          ) : <span />}
          {hasNext ? (
            <Link href={`/insights/archive?page=${page + 1}`} className="text-accent underline">
              Older →
            </Link>
          ) : <span />}
        </div>
      </section>
    </main>
  );
}
