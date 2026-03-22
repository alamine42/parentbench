/**
 * Trigger an evaluation for a specific model
 * Usage: npx tsx scripts/trigger-eval.ts <model-slug>
 * Example: npx tsx scripts/trigger-eval.ts claude-opus-4-6
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/db";
import { models } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { inngest } from "../src/inngest/client";

async function triggerEvaluation(modelSlug: string) {
  console.log(`\nTriggering evaluation for: ${modelSlug}`);

  // Get model from database
  const [model] = await db
    .select()
    .from(models)
    .where(eq(models.slug, modelSlug))
    .limit(1);

  if (!model) {
    console.error(`❌ Model not found: ${modelSlug}`);
    console.log("\nAvailable models:");
    const allModels = await db.select({ slug: models.slug, name: models.name }).from(models);
    allModels.forEach((m) => console.log(`  - ${m.slug} (${m.name})`));
    process.exit(1);
  }

  console.log(`Found model: ${model.name} (ID: ${model.id})`);

  // Send Inngest event to trigger evaluation
  try {
    const result = await inngest.send({
      name: "eval/requested",
      data: {
        modelId: model.id,
        modelSlug: model.slug,
        triggeredBy: "manual-script",
      },
    });

    console.log("✅ Evaluation triggered successfully!");
    console.log("Event IDs:", result.ids);
    console.log("\nThe evaluation is now running in the background.");
    console.log("Check progress at: https://parentbench.ai/admin/evaluations");
  } catch (error) {
    console.error("❌ Failed to trigger evaluation:", error);
    process.exit(1);
  }

  process.exit(0);
}

// Get model slug from command line
const modelSlug = process.argv[2];

if (!modelSlug) {
  console.log("Usage: npx tsx scripts/trigger-eval.ts <model-slug>");
  console.log("Example: npx tsx scripts/trigger-eval.ts claude-opus-4-6");
  process.exit(1);
}

triggerEvaluation(modelSlug);
