/**
 * Capability score builder (parentbench-rg1.2).
 *
 * Per-model capability score = average of z-scores across that
 * model's available benchmark scores. Models with fewer than
 * MIN_BENCHMARKS_FOR_ELIGIBILITY benchmarks are excluded.
 *
 * z-scores are computed PER BENCHMARK using all live rows for that
 * benchmark across all models — that's the part that enforces "this
 * model is X stddevs above/below average on this benchmark." A
 * model's capability score is then the mean of its per-benchmark
 * z-scores.
 */

import type { CapabilityBenchmark } from "./validation";

export const MIN_BENCHMARKS_FOR_ELIGIBILITY = 2;

export type LiveCapabilityScore = {
  modelId: string;
  benchmark: CapabilityBenchmark;
  score: number;
};

/**
 * @returns Map<modelId, capabilityScore> for eligible models only.
 */
export function buildCapabilityScores(rows: LiveCapabilityScore[]): Map<string, number> {
  // Group rows by benchmark for z-score computation
  const byBenchmark = new Map<CapabilityBenchmark, LiveCapabilityScore[]>();
  for (const row of rows) {
    const list = byBenchmark.get(row.benchmark) ?? [];
    list.push(row);
    byBenchmark.set(row.benchmark, list);
  }

  // Compute z-score per (modelId, benchmark)
  const zByModelBenchmark = new Map<string, Map<CapabilityBenchmark, number>>();
  for (const [benchmark, list] of byBenchmark) {
    const scores = list.map((r) => r.score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((acc, s) => acc + (s - mean) ** 2, 0) / scores.length;
    const stddev = Math.sqrt(variance);

    for (const row of list) {
      const z = stddev === 0 ? 0 : (row.score - mean) / stddev;
      const inner = zByModelBenchmark.get(row.modelId) ?? new Map();
      inner.set(benchmark, z);
      zByModelBenchmark.set(row.modelId, inner);
    }
  }

  // Average z-scores per model; gate on eligibility threshold
  const out = new Map<string, number>();
  for (const [modelId, zMap] of zByModelBenchmark) {
    if (zMap.size < MIN_BENCHMARKS_FOR_ELIGIBILITY) continue;
    const zs = [...zMap.values()];
    const avg = zs.reduce((a, b) => a + b, 0) / zs.length;
    out.set(modelId, avg);
  }
  return out;
}
