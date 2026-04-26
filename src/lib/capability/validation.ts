/**
 * Server-side validation for admin-curated capability scores
 * (parentbench-rg1.1, Codex WARNING #4 fix).
 *
 * Enforces 0–100 score range, http(s) URLs only, valid benchmark enum,
 * UUID-shaped modelId. Surfaces a non-blocking warning when shotSetting
 * is omitted so the admin sees that comparability across rows is
 * weakened.
 */

export const CAPABILITY_BENCHMARKS = ["mmlu", "gsm8k", "gpqa"] as const;
export type CapabilityBenchmark = (typeof CAPABILITY_BENCHMARKS)[number];

export type CapabilityScoreInput = {
  modelId: string;
  benchmark: CapabilityBenchmark;
  score: number;
  sourceUrl: string;
  shotSetting: string | null;
  benchmarkVariant: string | null;
  sourceNote: string | null;
};

export type ValidationResult =
  | { valid: true; warnings: string[] }
  | { valid: false; errors: string[]; warnings: string[] };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateCapabilityScoreInput(input: CapabilityScoreInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // modelId
  if (!input.modelId || !UUID_RE.test(input.modelId)) {
    errors.push("modelId must be a UUID");
  }

  // benchmark
  if (!CAPABILITY_BENCHMARKS.includes(input.benchmark)) {
    errors.push(`benchmark must be one of: ${CAPABILITY_BENCHMARKS.join(", ")}`);
  }

  // score
  if (typeof input.score !== "number" || !Number.isFinite(input.score)) {
    errors.push("score must be a finite number");
  } else if (input.score < 0 || input.score > 100) {
    errors.push("score must be between 0 and 100 inclusive");
  }

  // sourceUrl
  if (!input.sourceUrl) {
    errors.push("sourceUrl is required");
  } else if (!/^https?:\/\//i.test(input.sourceUrl)) {
    errors.push("sourceUrl must start with http:// or https://");
  }

  // shotSetting — informational only
  if (!input.shotSetting) {
    warnings.push("shotSetting_unspecified");
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }
  return { valid: true, warnings };
}
