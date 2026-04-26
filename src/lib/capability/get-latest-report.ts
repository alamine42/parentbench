/**
 * Read helper for the latest correlation report (parentbench-rg1.2).
 *
 * Defensive: tolerates the table not existing or having zero rows
 * (the empty-state path is part of the public UI design).
 */

import { desc } from "drizzle-orm";
import { db } from "@/db";
import { correlationReports } from "@/db/schema";

export type LatestCorrelationReport = {
  computedAt: Date;
  spearmanRho: number;
  spearmanRhoAbs: number;
  modelCount: number;
  benchmarksUsed: string[];
  perModelScores: Array<{ modelSlug: string; parentBenchScore: number; capabilityScore: number }>;
  methodologyVersion: string;
  ageInDays: number;
  isStale: boolean;
} | null;

const STALE_THRESHOLD_DAYS = 120;

export async function getLatestCorrelationReport(): Promise<LatestCorrelationReport> {
  try {
    const [row] = await db
      .select()
      .from(correlationReports)
      .orderBy(desc(correlationReports.computedAt))
      .limit(1);
    if (!row) return null;
    const ageMs = Date.now() - row.computedAt.getTime();
    const ageInDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    return {
      computedAt: row.computedAt,
      spearmanRho: row.spearmanRho,
      spearmanRhoAbs: row.spearmanRhoAbs,
      modelCount: row.modelCount,
      benchmarksUsed: row.benchmarksUsed,
      perModelScores: row.perModelScores,
      methodologyVersion: row.methodologyVersion,
      ageInDays,
      isStale: ageInDays > STALE_THRESHOLD_DAYS,
    };
  } catch (err) {
    console.warn("[capability] correlation_reports query failed; treating as no data:", err);
    return null;
  }
}
