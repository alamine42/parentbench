/**
 * Insights aggregator (parentbench-ov1.1).
 *
 * Pure function from already-fetched DB rows to an `InsightsAggregate`
 * object. The aggregate is the single numeric source of truth for both
 * the dashboard charts and the LLM-generated narrative.
 *
 * Empty buckets (`biggestMovers`, `newcomers`, `regressionWatch`) are
 * valid in calm windows — see Codex CRITICAL #3 in
 * docs/designs/insights-overview.md.
 */

import type { ParentBenchCategory } from "@/types/parentbench";
import { PARENTBENCH_CATEGORY_ORDER } from "@/lib/constants";

const SIGNIFICANT_DELTA = 5; // matches alert/score-changed threshold
const TOP_MOVERS_LIMIT = 5;

export type AggregatorActiveModel = {
  modelId: string;
  slug: string;
  name: string;
  provider: string;
  evalTier: "active" | "standard" | "maintenance" | "paused";
  isActive: boolean;
  createdAt: Date;
};

export type AggregatorScore = {
  modelId: string;
  overallScore: number;
  computedAt?: Date;
  categoryScores: Array<{
    category: string;
    score: number;
    grade: string;
    passRate: number;
    testCount: number;
  }>;
};

export type AggregatorPriorScore = {
  modelId: string;
  overallScore: number;
};

export type AggregatorInput = {
  asOf: Date;
  windowDays: number;
  activeModels: AggregatorActiveModel[];
  latestScores: AggregatorScore[];
  previousScores: AggregatorPriorScore[];
  evalsLast30d: number;
};

export type CategoryLeader = {
  modelSlug: string;
  modelName: string;
  provider: string;
  score: number;
};

export type BiggestMover = {
  modelSlug: string;
  modelName: string;
  provider: string;
  deltaPoints: number;
  previousScore: number;
  currentScore: number;
  direction: "up" | "down";
};

export type Newcomer = {
  modelSlug: string;
  modelName: string;
  provider: string;
  debutScore: number;
  debutGrade: string;
  addedAt: string;
  percentile: number;
};

export type RegressionEntry = {
  modelSlug: string;
  deltaPoints: number;
  currentScore: number;
};

export type ProviderRollup = {
  name: string;
  avgOverall: number;
  perCategory: Record<ParentBenchCategory, number>;
  activeModelCount: number;
};

export type InsightsAggregate = {
  generatedAt: string;
  dataThrough: string;
  windowDays: number;
  totals: {
    activeModels: number;
    providers: number;
    evalsLast30d: number;
  };
  spread: {
    topScore: number;
    topModelSlug: string;
    bottomScore: number;
    bottomModelSlug: string;
    gap: number;
    stdDev: number;
  };
  providers: ProviderRollup[];
  categoryLeaders: Record<ParentBenchCategory, CategoryLeader>;
  biggestMovers: BiggestMover[];
  newcomers: Newcomer[];
  regressionWatch: RegressionEntry[];
  displayValues: string[];
};

// ============================================================================
// MAIN
// ============================================================================

export function buildAggregate(input: AggregatorInput): InsightsAggregate {
  const activeIds = new Set(input.activeModels.map((m) => m.modelId));
  const modelById = new Map(input.activeModels.map((m) => [m.modelId, m]));
  const latestById = new Map(input.latestScores.map((s) => [s.modelId, s]));
  const priorById = new Map(input.previousScores.map((s) => [s.modelId, s.overallScore]));

  // Restrict scores to active models only
  const activeScores = input.latestScores.filter((s) => activeIds.has(s.modelId));

  const totals = {
    activeModels: input.activeModels.length,
    providers: new Set(input.activeModels.map((m) => m.provider)).size,
    evalsLast30d: input.evalsLast30d,
  };

  const spread = computeSpread(activeScores, modelById);
  const providers = computeProviderRollup(input.activeModels, latestById);
  const categoryLeaders = computeCategoryLeaders(activeScores, modelById);
  const biggestMovers = computeBiggestMovers(activeScores, modelById, priorById);
  const newcomers = computeNewcomers(input.activeModels, latestById, input.asOf, input.windowDays);
  const regressionWatch = computeRegressionWatch(activeScores, modelById, priorById);

  const aggregate: InsightsAggregate = {
    generatedAt: input.asOf.toISOString(),
    dataThrough: input.asOf.toISOString(),
    windowDays: input.windowDays,
    totals,
    spread,
    providers,
    categoryLeaders,
    biggestMovers,
    newcomers,
    regressionWatch,
    displayValues: [], // filled below
  };

  aggregate.displayValues = computeDisplayValues(aggregate);
  return aggregate;
}

// ============================================================================
// HELPERS
// ============================================================================

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function computeSpread(
  scores: AggregatorScore[],
  modelById: Map<string, AggregatorActiveModel>
) {
  if (scores.length === 0) {
    return { topScore: 0, topModelSlug: "", bottomScore: 0, bottomModelSlug: "", gap: 0, stdDev: 0 };
  }
  const sorted = [...scores].sort((a, b) => b.overallScore - a.overallScore);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  const mean = scores.reduce((acc, s) => acc + s.overallScore, 0) / scores.length;
  const variance = scores.reduce((acc, s) => acc + (s.overallScore - mean) ** 2, 0) / scores.length;
  return {
    topScore: top.overallScore,
    topModelSlug: modelById.get(top.modelId)?.slug ?? "",
    bottomScore: bottom.overallScore,
    bottomModelSlug: modelById.get(bottom.modelId)?.slug ?? "",
    gap: round1(top.overallScore - bottom.overallScore),
    stdDev: round1(Math.sqrt(variance)),
  };
}

function computeProviderRollup(
  models: AggregatorActiveModel[],
  latestById: Map<string, AggregatorScore>
): ProviderRollup[] {
  const byProvider = new Map<string, AggregatorActiveModel[]>();
  for (const m of models) {
    const list = byProvider.get(m.provider) ?? [];
    list.push(m);
    byProvider.set(m.provider, list);
  }

  const out: ProviderRollup[] = [];
  for (const [name, providerModels] of byProvider) {
    const scoredModels = providerModels
      .map((m) => latestById.get(m.modelId))
      .filter((s): s is AggregatorScore => Boolean(s));

    if (scoredModels.length === 0) {
      const empty = Object.fromEntries(
        PARENTBENCH_CATEGORY_ORDER.map((c) => [c, 0])
      ) as Record<ParentBenchCategory, number>;
      out.push({ name, avgOverall: 0, perCategory: empty, activeModelCount: providerModels.length });
      continue;
    }

    const avgOverall = round1(
      scoredModels.reduce((acc, s) => acc + s.overallScore, 0) / scoredModels.length
    );

    const perCategory = {} as Record<ParentBenchCategory, number>;
    for (const cat of PARENTBENCH_CATEGORY_ORDER) {
      const totals = scoredModels.map((s) => {
        const c = s.categoryScores.find((cs) => cs.category === cat);
        return c?.score ?? 0;
      });
      perCategory[cat] = round1(totals.reduce((a, b) => a + b, 0) / totals.length);
    }

    out.push({ name, avgOverall, perCategory, activeModelCount: providerModels.length });
  }
  return out;
}

function computeCategoryLeaders(
  scores: AggregatorScore[],
  modelById: Map<string, AggregatorActiveModel>
): Record<ParentBenchCategory, CategoryLeader> {
  const leaders = {} as Record<ParentBenchCategory, CategoryLeader>;
  for (const cat of PARENTBENCH_CATEGORY_ORDER) {
    let best: { score: number; modelId: string } | null = null;
    for (const s of scores) {
      const c = s.categoryScores.find((cs) => cs.category === cat);
      if (!c) continue;
      if (!best || c.score > best.score) {
        best = { score: c.score, modelId: s.modelId };
      }
    }
    if (best) {
      const m = modelById.get(best.modelId);
      leaders[cat] = {
        modelSlug: m?.slug ?? "",
        modelName: m?.name ?? "",
        provider: m?.provider ?? "",
        score: best.score,
      };
    } else {
      leaders[cat] = { modelSlug: "", modelName: "", provider: "", score: 0 };
    }
  }
  return leaders;
}

function computeBiggestMovers(
  scores: AggregatorScore[],
  modelById: Map<string, AggregatorActiveModel>,
  priorById: Map<string, number>
): BiggestMover[] {
  const movers: BiggestMover[] = [];
  for (const s of scores) {
    const prior = priorById.get(s.modelId);
    if (prior === undefined) continue;
    const delta = round1(s.overallScore - prior);
    if (Math.abs(delta) < SIGNIFICANT_DELTA) continue;
    const m = modelById.get(s.modelId);
    movers.push({
      modelSlug: m?.slug ?? "",
      modelName: m?.name ?? "",
      provider: m?.provider ?? "",
      deltaPoints: delta,
      previousScore: prior,
      currentScore: s.overallScore,
      direction: delta > 0 ? "up" : "down",
    });
  }
  return movers
    .sort((a, b) => Math.abs(b.deltaPoints) - Math.abs(a.deltaPoints))
    .slice(0, TOP_MOVERS_LIMIT);
}

function computeNewcomers(
  models: AggregatorActiveModel[],
  latestById: Map<string, AggregatorScore>,
  asOf: Date,
  windowDays: number
): Newcomer[] {
  const cutoff = new Date(asOf.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const newModels = models.filter((m) => m.createdAt >= cutoff);
  if (newModels.length === 0) return [];

  // For percentile, rank against all currently-scored active models
  const allScores = [...latestById.values()].map((s) => s.overallScore).sort((a, b) => a - b);

  const out: Newcomer[] = [];
  for (const m of newModels) {
    const score = latestById.get(m.modelId);
    if (!score) continue;
    const rank = allScores.filter((s) => s < score.overallScore).length;
    const percentile = allScores.length <= 1 ? 0 : rank / (allScores.length - 1);
    out.push({
      modelSlug: m.slug,
      modelName: m.name,
      provider: m.provider,
      debutScore: score.overallScore,
      debutGrade: deriveGrade(score.overallScore),
      addedAt: m.createdAt.toISOString(),
      percentile: round1(percentile),
    });
  }
  return out;
}

function computeRegressionWatch(
  scores: AggregatorScore[],
  modelById: Map<string, AggregatorActiveModel>,
  priorById: Map<string, number>
): RegressionEntry[] {
  const out: RegressionEntry[] = [];
  for (const s of scores) {
    const prior = priorById.get(s.modelId);
    if (prior === undefined) continue;
    const delta = round1(s.overallScore - prior);
    if (delta <= -SIGNIFICANT_DELTA) {
      out.push({
        modelSlug: modelById.get(s.modelId)?.slug ?? "",
        deltaPoints: delta,
        currentScore: s.overallScore,
      });
    }
  }
  return out;
}

/** Subset of grade thresholds — avoids importing the full GRADE_THRESHOLDS table. */
function deriveGrade(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 63) return "D";
  if (score >= 60) return "D-";
  return "F";
}

// ============================================================================
// DISPLAY VALUES
// ============================================================================

/**
 * Precompute every human-readable rendering the writer is allowed to use.
 * Numeric guard accepts these exactly OR ±0.5 of any raw aggregate number.
 */
function computeDisplayValues(agg: InsightsAggregate): string[] {
  const values = new Set<string>();

  // Counts
  values.add(String(agg.totals.activeModels));
  values.add(String(agg.totals.providers));
  values.add(String(agg.totals.evalsLast30d));

  // Spread
  pushNumber(values, agg.spread.topScore);
  pushNumber(values, agg.spread.bottomScore);
  pushNumber(values, agg.spread.gap);
  pushNumber(values, agg.spread.stdDev);

  // Provider rollups
  for (const p of agg.providers) {
    values.add(p.name);
    values.add(String(p.activeModelCount));
    pushNumber(values, p.avgOverall);
    for (const cat of PARENTBENCH_CATEGORY_ORDER) {
      pushNumber(values, p.perCategory[cat] ?? 0);
    }
  }

  // Category leaders
  for (const cat of PARENTBENCH_CATEGORY_ORDER) {
    const leader = agg.categoryLeaders[cat];
    if (!leader || !leader.modelSlug) continue;
    values.add(leader.modelName);
    values.add(leader.provider);
    pushNumber(values, leader.score);
  }

  // Movers, newcomers, regressions
  for (const m of agg.biggestMovers) {
    values.add(m.modelName);
    values.add(m.provider);
    pushNumber(values, m.currentScore);
    pushNumber(values, m.previousScore);
    pushNumber(values, Math.abs(m.deltaPoints));
  }
  for (const n of agg.newcomers) {
    values.add(n.modelName);
    values.add(n.provider);
    pushNumber(values, n.debutScore);
  }
  for (const r of agg.regressionWatch) {
    pushNumber(values, Math.abs(r.deltaPoints));
    pushNumber(values, r.currentScore);
  }

  return [...values];
}

function pushNumber(set: Set<string>, n: number) {
  set.add(String(n));
  const rounded = Math.round(n);
  set.add(String(rounded));
}
