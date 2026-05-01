/**
 * Multi-surface validation helpers used by scripts/validate-data.ts
 * (parentbench-6h3). Pure — operates on shaped data, not filesystem.
 */

import type { EvaluationSurface } from "@/types/parentbench";

export type ScoreRowShape = {
  modelSlug: string;
  surface: EvaluationSurface;
  overallScore: number;
  overallGrade: string;
  evaluatedDate: string;
};

export type ValidationResult = {
  errors: string[];
};

const DEFAULT_SURFACE: EvaluationSurface = "api-default";

/**
 * One row per (modelSlug, surface) is the multi-surface invariant.
 * Pre-migration rows without a `surface` field collapse to
 * `api-default` for back-compat — duplicates surface as collisions.
 */
export function assertOnePerModelSurface(
  rows: ScoreRowShape[]
): ValidationResult {
  const seen = new Map<string, number>();
  const errors: string[] = [];
  for (const row of rows) {
    const surface = row.surface ?? DEFAULT_SURFACE;
    const key = `${row.modelSlug}\0${surface}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  for (const [key, count] of seen.entries()) {
    if (count > 1) {
      const [modelSlug, surface] = key.split("\0");
      errors.push(
        `Duplicate score row for (${modelSlug}, ${surface}) — expected one per (model, surface).`
      );
    }
  }
  return { errors };
}
