/**
 * Trigger evaluations for every active model in a given tier.
 * Usage: npx tsx scripts/trigger-tier-evals.ts <tier>
 * Example: npx tsx scripts/trigger-tier-evals.ts active
 *
 * Mirrors what the cron `scheduledEval{Tier}` function does, but runs on
 * demand. Tier flags match the cron: active = full + judge,
 * standard / maintenance = sampled + heuristic.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const TIER_FLAGS = {
  active: { sampleTestCases: false, useLlmJudge: true },
  standard: { sampleTestCases: true, useLlmJudge: false },
  maintenance: { sampleTestCases: true, useLlmJudge: false },
} as const;

type Tier = keyof typeof TIER_FLAGS;

async function main(tier: Tier) {
  const { db } = await import("../src/db/index.js");
  const { models, providers } = await import("../src/db/schema.js");
  const { eq, and } = await import("drizzle-orm");
  const { inngest } = await import("../src/inngest/client.js");

  const rows = await db
    .select({ id: models.id, slug: models.slug, name: models.name, provider: providers.name })
    .from(models)
    .innerJoin(providers, eq(models.providerId, providers.id))
    .where(and(eq(models.evalTier, tier), eq(models.isActive, true)));

  if (rows.length === 0) {
    console.log(`No active models in tier "${tier}".`);
    process.exit(0);
  }

  const flags = TIER_FLAGS[tier];
  console.log(`\nTriggering ${rows.length} ${tier}-tier evaluations`);
  console.log(`  sampleTestCases=${flags.sampleTestCases}, useLlmJudge=${flags.useLlmJudge}\n`);
  for (const r of rows) console.log(`  - ${r.slug.padEnd(28)} ${r.provider} / ${r.name}`);

  const events = rows.map((m) => ({
    name: "eval/requested" as const,
    data: {
      modelId: m.id,
      modelSlug: m.slug,
      triggeredBy: `manual-tier-${tier}`,
      sampleTestCases: flags.sampleTestCases,
      useLlmJudge: flags.useLlmJudge,
    },
  }));

  const result = await inngest.send(events);
  console.log(`\nSent ${result.ids.length} eval/requested events.`);
  console.log("Watch progress: https://parentbench.ai/admin/evaluations");
  process.exit(0);
}

const tier = process.argv[2] as Tier | undefined;
if (!tier || !(tier in TIER_FLAGS)) {
  console.log("Usage: npx tsx scripts/trigger-tier-evals.ts <active|standard|maintenance>");
  process.exit(1);
}
main(tier);
