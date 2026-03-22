#!/usr/bin/env npx tsx
/**
 * Test evaluation - runs a few test cases directly against a model
 * Usage: npx tsx scripts/test-eval.ts <model-slug>
 */

import { config } from "dotenv";

// Load .env.local FIRST
const result = config({ path: ".env.local" });
if (result.error) {
  console.error("Failed to load .env.local:", result.error);
  process.exit(1);
}

async function main() {
  // Dynamic imports after env is loaded
  const { db } = await import("../src/db/index.js");
  const { models, testCases } = await import("../src/db/schema.js");
  const { eq } = await import("drizzle-orm");
  const { runModelAdapter } = await import("../src/lib/eval/adapters/index.js");

  const modelSlug = process.argv[2] || "claude-opus-4-6";
  console.log(`\n🧪 Testing evaluation for: ${modelSlug}\n`);

  // Get model from database
  const [model] = await db
    .select()
    .from(models)
    .where(eq(models.slug, modelSlug))
    .limit(1);

  if (!model) {
    console.error(`❌ Model not found: ${modelSlug}`);
    const allModels = await db.select({ slug: models.slug }).from(models);
    console.log("Available:", allModels.map((m) => m.slug).join(", "));
    process.exit(1);
  }

  console.log(`Found model: ${model.name}`);

  // Get first 3 test cases
  const testCaseSamples = await db
    .select()
    .from(testCases)
    .where(eq(testCases.isActive, true))
    .limit(3);

  console.log(`Running ${testCaseSamples.length} test cases...\n`);

  let passed = 0;
  let failed = 0;

  for (const tc of testCaseSamples) {
    console.log(`📝 Test: ${tc.description}`);
    console.log(`   Prompt: "${tc.prompt.substring(0, 60)}..."`);

    try {
      const result = await runModelAdapter(modelSlug, {
        ...tc,
        createdAt: tc.createdAt.toISOString(),
        updatedAt: tc.updatedAt.toISOString(),
      });

      if (result.passed) {
        console.log(`   ✅ PASSED (score: ${result.score})`);
        passed++;
      } else {
        console.log(`   ❌ FAILED (score: ${result.score})`);
        failed++;
      }
      console.log(`   Response: "${result.response.substring(0, 100)}..."\n`);
    } catch (error) {
      console.log(`   ❌ ERROR: ${error instanceof Error ? error.message : error}\n`);
      failed++;
    }
  }

  console.log("━".repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("━".repeat(50));

  process.exit(0);
}

main().catch(console.error);
