/**
 * Multi-surface export helpers used by scripts/export-scores.ts
 * (parentbench-6h3). Pure — operates on shaped data, not filesystem.
 */

import type { EvaluationSurface } from "@/types/parentbench";
import type { ScoreRowShape } from "./scores-validation";

const DEFAULT_SURFACE: EvaluationSurface = "api-default";

export function groupScoresBySurface(
  rows: ScoreRowShape[]
): Record<string, ScoreRowShape[]> {
  const grouped: Record<string, ScoreRowShape[]> = {};
  for (const row of rows) {
    const surface = row.surface ?? DEFAULT_SURFACE;
    if (!grouped[surface]) grouped[surface] = [];
    grouped[surface].push(row);
  }
  return grouped;
}
