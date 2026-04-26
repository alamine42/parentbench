#!/usr/bin/env npx tsx
/**
 * Seed initial capability benchmark scores from public sources
 * (parentbench-rg1.2 follow-up).
 *
 * Hand-curated from web research on 2026-04-26. Each row carries:
 *   - score (0..100)
 *   - shotSetting (best-effort per source)
 *   - sourceUrl (the page where the score was published)
 *   - sourceNote (caveats; may be null)
 *
 * Idempotent: skips rows where a live (unsuperseded) entry already
 * exists for the same (modelId, benchmark) pair.
 *
 * IMPORTANT: shot/mode settings are NOT uniform across rows because
 * providers don't report uniformly. The benchmarkVariant + sourceNote
 * fields capture the difference. Comparability is weaker than ideal;
 * the methodology page should disclose this.
 *
 * Usage:
 *   npx tsx scripts/seed-capability-scores.ts --dry-run
 *   npx tsx scripts/seed-capability-scores.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

type SeedRow = {
  modelSlug: string;
  benchmark: "mmlu" | "gpqa" | "aime_2025";
  score: number;
  shotSetting: string;
  benchmarkVariant: string | null;
  sourceUrl: string;
  sourceNote: string | null;
};

const SEED: SeedRow[] = [
  // ---- Claude Opus 4.7 ----
  {
    modelSlug: "claude-opus-4-7",
    benchmark: "mmlu",
    score: 89.8,
    shotSetting: "5-shot",
    benchmarkVariant: null,
    sourceUrl: "https://www.vellum.ai/blog/claude-opus-4-7-benchmarks-explained",
    sourceNote: null,
  },
  {
    modelSlug: "claude-opus-4-7",
    benchmark: "gpqa",
    score: 94.2,
    shotSetting: "with-thinking",
    benchmarkVariant: "Diamond",
    sourceUrl: "https://www.vellum.ai/blog/claude-opus-4-7-benchmarks-explained",
    sourceNote: null,
  },

  // ---- Claude Sonnet 4.6 ----
  {
    modelSlug: "claude-sonnet-4-6",
    benchmark: "mmlu",
    score: 89.3,
    shotSetting: "5-shot",
    benchmarkVariant: null,
    sourceUrl: "https://www.morphllm.com/claude-benchmarks",
    sourceNote: null,
  },
  {
    modelSlug: "claude-sonnet-4-6",
    benchmark: "gpqa",
    score: 89.9,
    shotSetting: "with-thinking",
    benchmarkVariant: "Diamond",
    sourceUrl: "https://www.anthropic.com/claude-sonnet-4-6-system-card",
    sourceNote: "Averaged over 10 trials with adaptive thinking + max effort",
  },

  // ---- Claude Haiku 4.5 ----
  {
    modelSlug: "claude-haiku-4-5",
    benchmark: "aime_2025",
    score: 80.7,
    shotSetting: "with-thinking",
    benchmarkVariant: null,
    sourceUrl: "https://artificialanalysis.ai/models/claude-4-5-haiku",
    sourceNote: "pass@1 averaged over 10 runs × 16 trials, 128K thinking budget",
  },

  // ---- Gemini 3 Flash ----
  // (skipped MMLU: sources reported 92% and 78% on different variants — ambiguous)
  {
    modelSlug: "gemini-3-flash",
    benchmark: "gpqa",
    score: 90.4,
    shotSetting: "0-shot",
    benchmarkVariant: "Diamond",
    sourceUrl: "https://blog.google/products/gemini/gemini-3-flash/",
    sourceNote: null,
  },
  {
    modelSlug: "gemini-3-flash",
    benchmark: "aime_2025",
    score: 99.7,
    shotSetting: "with-tools",
    benchmarkVariant: null,
    sourceUrl: "https://www.datalearner.com/en/ai-models/pretrained-models/gemini3-flash/analysis",
    sourceNote: "Near-saturation; with code execution tools",
  },

  // ---- Gemini 3.1 Pro ----
  // (skipped MMLU: only have MMLU-Pro 90.5; not directly comparable to standard MMLU column)
  {
    modelSlug: "gemini-3-1-pro",
    benchmark: "gpqa",
    score: 94.1,
    shotSetting: "0-shot",
    benchmarkVariant: "Diamond",
    sourceUrl: "https://artificialanalysis.ai/models/gemini-3-1-pro",
    sourceNote: null,
  },

  // ---- Gemini 2.5 Pro ----
  {
    modelSlug: "gemini-2-5-pro",
    benchmark: "mmlu",
    score: 88.5,
    shotSetting: "5-shot",
    benchmarkVariant: null,
    sourceUrl: "https://artificialanalysis.ai/models/gemini-2-5-pro",
    sourceNote: null,
  },
  {
    modelSlug: "gemini-2-5-pro",
    benchmark: "gpqa",
    score: 84.0,
    shotSetting: "0-shot pass@1",
    benchmarkVariant: "Diamond",
    sourceUrl: "https://artificialanalysis.ai/models/gemini-2-5-pro",
    sourceNote: null,
  },

  // ---- GPT-5 ----
  {
    modelSlug: "gpt-5",
    benchmark: "mmlu",
    score: 91.4,
    shotSetting: "5-shot",
    benchmarkVariant: null,
    sourceUrl: "https://artificialanalysis.ai/articles/gpt-5-benchmarks-and-analysis",
    sourceNote: null,
  },
  {
    modelSlug: "gpt-5",
    benchmark: "gpqa",
    score: 89.4,
    shotSetting: "with-tools",
    benchmarkVariant: "Diamond",
    sourceUrl: "https://openai.com/index/introducing-gpt-5/",
    sourceNote: "GPT-5 pro with Python tools",
  },
  {
    modelSlug: "gpt-5",
    benchmark: "aime_2025",
    score: 94.6,
    shotSetting: "without-tools",
    benchmarkVariant: null,
    sourceUrl: "https://openai.com/index/introducing-gpt-5/",
    sourceNote: null,
  },

  // ---- GPT-5.4 ----
  // (only GPQA available — under 2-benchmark eligibility floor; included for record)
  {
    modelSlug: "gpt-5-4",
    benchmark: "gpqa",
    score: 92.0,
    shotSetting: "with-thinking",
    benchmarkVariant: "Diamond",
    sourceUrl: "https://pricepertoken.com/leaderboards/benchmark/gpqa",
    sourceNote: null,
  },

  // ---- GPT-5 mini ----
  {
    modelSlug: "gpt-5-mini",
    benchmark: "gpqa",
    score: 82.3,
    shotSetting: "0-shot",
    benchmarkVariant: "Diamond",
    sourceUrl: "https://www.vals.ai/models/openai_gpt-5-mini-2025-08-07",
    sourceNote: null,
  },
  {
    modelSlug: "gpt-5-mini",
    benchmark: "aime_2025",
    score: 91.1,
    shotSetting: "with-tools",
    benchmarkVariant: null,
    sourceUrl: "https://www.vals.ai/models/openai_gpt-5-mini-2025-08-07",
    sourceNote: null,
  },
];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(dryRun ? "DRY RUN — no DB writes\n" : "APPLYING\n");

  const { db } = await import("../src/db/index.js");
  const { models, modelCapabilityScores } = await import("../src/db/schema.js");
  const { eq, and, isNull } = await import("drizzle-orm");

  const allModels = await db.select({ id: models.id, slug: models.slug }).from(models);
  const idBySlug = new Map(allModels.map((m) => [m.slug, m.id]));

  let inserted = 0;
  let skipped = 0;
  const missing: string[] = [];

  for (const row of SEED) {
    const modelId = idBySlug.get(row.modelSlug);
    if (!modelId) {
      missing.push(row.modelSlug);
      continue;
    }

    const [existing] = await db
      .select({ id: modelCapabilityScores.id })
      .from(modelCapabilityScores)
      .where(
        and(
          eq(modelCapabilityScores.modelId, modelId),
          eq(modelCapabilityScores.benchmark, row.benchmark),
          isNull(modelCapabilityScores.supersededAt)
        )
      )
      .limit(1);

    if (existing) {
      console.log(`SKIP  ${row.modelSlug.padEnd(20)} ${row.benchmark.padEnd(10)} (live row already exists)`);
      skipped++;
      continue;
    }

    console.log(`INSERT ${row.modelSlug.padEnd(20)} ${row.benchmark.padEnd(10)} ${String(row.score).padEnd(6)} ${row.shotSetting}`);
    if (!dryRun) {
      await db.insert(modelCapabilityScores).values({
        modelId,
        benchmark: row.benchmark,
        score: row.score,
        shotSetting: row.shotSetting,
        benchmarkVariant: row.benchmarkVariant,
        sourceUrl: row.sourceUrl,
        sourceNote: row.sourceNote,
        recordedBy: "seed-script-2026-04-26",
      });
    }
    inserted++;
  }

  console.log(`\nSeed: inserted=${inserted}, skipped=${skipped}, missing-models=${missing.length}`);
  if (missing.length) console.log(`Missing: ${missing.join(", ")}`);
  console.log(dryRun ? "\nDry run complete — re-run without --dry-run to apply." : "\n✅ Seed applied.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
