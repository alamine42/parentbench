/**
 * /admin/insights — admin dashboard for insights reports (parentbench-ov1.8).
 *
 * Lists all reports with their status, lets the admin trigger a fresh
 * regeneration, and provides retract / unretract actions on rows.
 */

import { db } from "@/db";
import { insightsReports } from "@/db/schema";
import { desc } from "drizzle-orm";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { AdminInsightsClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminInsightsPage() {
  const rows = await db
    .select({
      id: insightsReports.id,
      slug: insightsReports.slug,
      status: insightsReports.status,
      generatedAt: insightsReports.generatedAt,
      dataThrough: insightsReports.dataThrough,
      generatorModel: insightsReports.generatorModel,
      generatorCostUsd: insightsReports.generatorCostUsd,
      triggerReason: insightsReports.triggerReason,
      failureReason: insightsReports.failureReason,
    })
    .from(insightsReports)
    .orderBy(desc(insightsReports.generatedAt))
    .limit(50);

  const totalCost = rows.reduce((sum, r) => sum + (r.generatorCostUsd ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold">Insights reports</h1>
          <p className="text-sm text-muted">Manage the auto-generated /insights pages.</p>
        </div>
        <AdminInsightsClient />
      </div>

      <div className="rounded-lg border border-card-border bg-card-bg p-5">
        <p className="text-sm text-muted">Total generator cost (last 50 reports)</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">${totalCost.toFixed(4)}</p>
      </div>

      <div className="rounded-lg border border-card-border bg-card-bg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-card-border bg-muted-bg/50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <Th>Slug</Th>
              <Th>Status</Th>
              <Th>Generated</Th>
              <Th>Data through</Th>
              <Th>Trigger</Th>
              <Th>Model</Th>
              <Th>Cost</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border">
            {rows.map((r) => (
              <tr key={r.id}>
                <Td>
                  <Link className="text-accent underline" href={`/insights/${r.slug}`}>{r.slug}</Link>
                </Td>
                <Td><StatusPill status={r.status} /></Td>
                <Td>{formatDate(r.generatedAt.toISOString())}</Td>
                <Td>{formatDate(r.dataThrough.toISOString())}</Td>
                <Td className="text-xs text-muted">{r.triggerReason}</Td>
                <Td className="text-xs">{r.generatorModel}</Td>
                <Td className="tabular-nums">{r.generatorCostUsd ? `$${r.generatorCostUsd.toFixed(4)}` : "—"}</Td>
                <Td>
                  <RowActions id={r.id} status={r.status} />
                </Td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="p-6 text-center text-muted">No reports yet. Click &quot;Regenerate now&quot; to create the first one.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {rows.some((r) => r.status === "generation_failed" && r.failureReason) ? (
        <div className="rounded-lg border border-amber-300/40 bg-amber-50 p-4 text-sm dark:bg-amber-900/20">
          <p className="mb-2 font-semibold">Recent failures</p>
          <ul className="space-y-1 text-xs">
            {rows.filter((r) => r.status === "generation_failed" && r.failureReason).slice(0, 5).map((r) => (
              <li key={r.id}><span className="font-mono">{r.slug}</span>: {r.failureReason}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left">{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

function StatusPill({ status }: { status: "draft" | "generation_failed" | "published" | "retracted" }) {
  const styles: Record<typeof status, string> = {
    draft: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
    generation_failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
    published: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    retracted: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${styles[status]}`}>{status}</span>;
}

function RowActions({ id, status }: { id: string; status: "draft" | "generation_failed" | "published" | "retracted" }) {
  // Server-rendered placeholder — actions live on the client component
  return <RowActionsClient id={id} status={status} />;
}

import { RowActionsClient } from "./row-actions";
