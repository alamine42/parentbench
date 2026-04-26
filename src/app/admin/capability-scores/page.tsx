/**
 * /admin/capability-scores — capability benchmark curation
 * (parentbench-rg1.1).
 *
 * Server component lists active models with their per-benchmark
 * coverage. Client component handles add/edit/history modals.
 */

import { db } from "@/db";
import { modelCapabilityScores, models, providers } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { computeCoverage, selectLiveScores } from "@/lib/capability/coverage";
import { CAPABILITY_BENCHMARKS } from "@/lib/capability/validation";
import { CapabilityScoresClient } from "./client";

export const dynamic = "force-dynamic";

export default async function CapabilityScoresPage() {
  const activeModels = await db
    .select({
      id: models.id,
      slug: models.slug,
      name: models.name,
      provider: providers.name,
    })
    .from(models)
    .innerJoin(providers, eq(models.providerId, providers.id))
    .where(and(eq(models.isActive, true), eq(models.evalTier, "active")));

  const liveRows = await db
    .select()
    .from(modelCapabilityScores)
    .where(isNull(modelCapabilityScores.supersededAt));

  const live = selectLiveScores(
    liveRows.map((r) => ({
      id: r.id,
      modelId: r.modelId,
      benchmark: r.benchmark,
      score: r.score,
      recordedAt: r.recordedAt,
      supersededAt: r.supersededAt,
    }))
  );
  const coverage = computeCoverage(activeModels.map((m) => m.id), live);

  // Build a (modelId × benchmark) score map for the table
  const liveByModelBenchmark = new Map<string, Map<string, { score: number; recordedAt: Date }>>();
  for (const r of live) {
    const inner = liveByModelBenchmark.get(r.modelId) ?? new Map();
    inner.set(r.benchmark, { score: r.score, recordedAt: r.recordedAt });
    liveByModelBenchmark.set(r.modelId, inner);
  }

  const enriched = activeModels.map((m) => {
    const cov = coverage.get(m.id);
    const inner = liveByModelBenchmark.get(m.id) ?? new Map();
    const benchmarks = CAPABILITY_BENCHMARKS.map((b) => ({
      benchmark: b,
      live: inner.get(b) ?? null,
    }));
    return {
      id: m.id,
      slug: m.slug,
      name: m.name,
      provider: m.provider,
      coverageCount: cov?.count ?? 0,
      coverageTotal: cov?.total ?? CAPABILITY_BENCHMARKS.length,
      eligible: (cov?.count ?? 0) >= 2,
      benchmarks,
    };
  });

  // Sort: incomplete coverage first (so admins see what to fix), then alpha
  enriched.sort((a, b) => {
    if (a.coverageCount !== b.coverageCount) return a.coverageCount - b.coverageCount;
    return a.name.localeCompare(b.name);
  });

  const eligibleCount = enriched.filter((m) => m.eligible).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Capability benchmark scores</h1>
        <p className="text-sm text-muted">
          Per-model MMLU / GPQA / AIME 2025 scores from public sources. The
          quarterly correlation report (rg1.2) requires <strong>≥2 of 3
          benchmarks</strong> per model. Edits append a new row;
          history is preserved.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Active models" value={enriched.length} />
        <Stat label="Eligible (≥2 benchmarks)" value={eligibleCount} />
        <Stat label="Live rows" value={live.length} />
        <Stat label="Min for compute" value={5} hint="≥5 eligible required" />
      </div>

      <CapabilityScoresClient models={enriched} />
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border border-card-border bg-card-bg p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
