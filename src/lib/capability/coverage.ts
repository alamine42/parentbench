/**
 * Capability coverage computation (parentbench-rg1.1).
 *
 * Pure helpers over the (history-preserving) `model_capability_scores`
 * shape. The "live" row per (modelId, benchmark) is the one with
 * `supersededAt = null`. Coverage is the count of live benchmarks for
 * a given model.
 */

import { CAPABILITY_BENCHMARKS, type CapabilityBenchmark } from "./validation";

export type CapabilityScoreRow = {
  id: string;
  modelId: string;
  benchmark: CapabilityBenchmark;
  score: number;
  recordedAt: Date;
  supersededAt: Date | null;
};

export type ModelCoverage = {
  present: CapabilityBenchmark[];
  missing: CapabilityBenchmark[];
  count: number;
  total: number;
};

/**
 * Filter rows down to the live (unsuperseded) entries. Belt-and-suspenders
 * with the DB column — we never want to silently use a superseded row.
 */
export function selectLiveScores<T extends CapabilityScoreRow>(rows: T[]): T[] {
  return rows.filter((r) => r.supersededAt === null);
}

/**
 * Per-model count + missing-list of benchmarks. Models supplied via
 * `modelIds` always appear in the result, even if they have no rows.
 */
export function computeCoverage(
  modelIds: string[],
  rows: CapabilityScoreRow[]
): Map<string, ModelCoverage> {
  const live = selectLiveScores(rows);
  const byModel = new Map<string, Set<CapabilityBenchmark>>();
  for (const r of live) {
    const set = byModel.get(r.modelId) ?? new Set<CapabilityBenchmark>();
    set.add(r.benchmark);
    byModel.set(r.modelId, set);
  }

  const out = new Map<string, ModelCoverage>();
  for (const modelId of modelIds) {
    const present = [...(byModel.get(modelId) ?? [])];
    const missing = CAPABILITY_BENCHMARKS.filter((b) => !present.includes(b));
    out.set(modelId, {
      present,
      missing,
      count: present.length,
      total: CAPABILITY_BENCHMARKS.length,
    });
  }
  return out;
}
