#!/usr/bin/env npx tsx
/**
 * Update OpenAI models to current frontier models
 */

import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/db/index.js");
  const { models, providers } = await import("../src/db/schema.js");
  const { eq, and } = await import("drizzle-orm");

  console.log("Updating OpenAI models...\n");

  // Get OpenAI provider ID
  const [openai] = await db
    .select()
    .from(providers)
    .where(eq(providers.slug, "openai"))
    .limit(1);

  if (!openai) {
    console.error("OpenAI provider not found!");
    process.exit(1);
  }

  console.log(`OpenAI provider ID: ${openai.id}\n`);

  // Models to remove (outdated)
  const modelsToRemove = ["gpt-4-turbo", "gpt-4-5", "gpt-5-3", "o1", "o1-mini"];

  // Models to add (current frontier)
  const modelsToAdd = [
    { slug: "gpt-4o-mini", name: "GPT-4o mini" },
    { slug: "gpt-4-1", name: "GPT-4.1" },
    { slug: "gpt-4-1-mini", name: "GPT-4.1 mini" },
    { slug: "gpt-5", name: "GPT-5" },
    { slug: "gpt-5-mini", name: "GPT-5 mini" },
    { slug: "gpt-5-nano", name: "GPT-5 nano" },
    { slug: "gpt-5-4", name: "GPT-5.4" },
    { slug: "gpt-5-4-pro", name: "GPT-5.4 Pro" },
    { slug: "gpt-5-4-mini", name: "GPT-5.4 mini" },
    { slug: "gpt-5-4-nano", name: "GPT-5.4 nano" },
    { slug: "gpt-5-5", name: "GPT-5.5" },
    { slug: "o3", name: "o3" },
    { slug: "o3-pro", name: "o3 Pro" },
    { slug: "o4-mini", name: "o4-mini" },
  ];

  // Remove outdated models
  console.log("Removing outdated models:");
  for (const slug of modelsToRemove) {
    const result = await db
      .delete(models)
      .where(and(eq(models.slug, slug), eq(models.providerId, openai.id)))
      .returning({ slug: models.slug });

    if (result.length > 0) {
      console.log(`  ✗ Removed: ${slug}`);
    } else {
      console.log(`  - Not found: ${slug}`);
    }
  }

  // Add new models
  console.log("\nAdding new models:");
  for (const model of modelsToAdd) {
    // Check if already exists
    const [existing] = await db
      .select()
      .from(models)
      .where(eq(models.slug, model.slug))
      .limit(1);

    if (existing) {
      console.log(`  - Already exists: ${model.slug}`);
      continue;
    }

    await db.insert(models).values({
      slug: model.slug,
      name: model.name,
      providerId: openai.id,
      isActive: true,
    });
    console.log(`  ✓ Added: ${model.slug} (${model.name})`);
  }

  // List final OpenAI models
  console.log("\nFinal OpenAI models:");
  const finalModels = await db
    .select({ slug: models.slug, name: models.name })
    .from(models)
    .where(eq(models.providerId, openai.id))
    .orderBy(models.name);

  for (const m of finalModels) {
    console.log(`  - ${m.slug}: ${m.name}`);
  }

  console.log(`\nTotal: ${finalModels.length} OpenAI models`);
  process.exit(0);
}

main().catch(console.error);
