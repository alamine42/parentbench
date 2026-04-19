#!/usr/bin/env npx tsx
/**
 * Update Anthropic and Google models to current frontier models
 */

import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/db/index.js");
  const { models, providers } = await import("../src/db/schema.js");
  const { eq, and } = await import("drizzle-orm");

  // ============================================================================
  // ANTHROPIC
  // ============================================================================
  console.log("=".repeat(60));
  console.log("UPDATING ANTHROPIC MODELS");
  console.log("=".repeat(60));

  const [anthropic] = await db
    .select()
    .from(providers)
    .where(eq(providers.slug, "anthropic"))
    .limit(1);

  if (!anthropic) {
    console.error("Anthropic provider not found!");
    process.exit(1);
  }

  // Models to remove (outdated naming)
  const anthropicToRemove = [
    "claude-3-haiku",      // Deprecated
    "claude-3-opus",       // Old naming
    "claude-3-5-haiku",    // Old naming
    "claude-3-5-sonnet",   // Old naming
    "claude-4-5-sonnet",   // Old naming
  ];

  // Models to add (current frontier)
  const anthropicToAdd = [
    // Latest generation
    { slug: "claude-opus-4-7", name: "Claude Opus 4.7" },
    { slug: "claude-opus-4-6", name: "Claude Opus 4.6" },
    { slug: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    { slug: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
    // Previous generation (still supported)
    { slug: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
    { slug: "claude-opus-4-5", name: "Claude Opus 4.5" },
    { slug: "claude-opus-4-1", name: "Claude Opus 4.1" },
    { slug: "claude-sonnet-4", name: "Claude Sonnet 4" },
    { slug: "claude-opus-4", name: "Claude Opus 4" },
  ];

  console.log("\nRemoving outdated models:");
  for (const slug of anthropicToRemove) {
    const result = await db
      .delete(models)
      .where(and(eq(models.slug, slug), eq(models.providerId, anthropic.id)))
      .returning({ slug: models.slug });

    if (result.length > 0) {
      console.log(`  ✗ Removed: ${slug}`);
    } else {
      console.log(`  - Not found: ${slug}`);
    }
  }

  console.log("\nAdding/updating models:");
  for (const model of anthropicToAdd) {
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
      providerId: anthropic.id,
      isActive: true,
    });
    console.log(`  ✓ Added: ${model.slug} (${model.name})`);
  }

  // List final Anthropic models
  console.log("\nFinal Anthropic models:");
  const finalAnthropic = await db
    .select({ slug: models.slug, name: models.name })
    .from(models)
    .where(eq(models.providerId, anthropic.id))
    .orderBy(models.name);

  for (const m of finalAnthropic) {
    console.log(`  - ${m.slug}: ${m.name}`);
  }
  console.log(`Total: ${finalAnthropic.length} Anthropic models`);

  // ============================================================================
  // GOOGLE
  // ============================================================================
  console.log("\n" + "=".repeat(60));
  console.log("UPDATING GOOGLE MODELS");
  console.log("=".repeat(60));

  const [google] = await db
    .select()
    .from(providers)
    .where(eq(providers.slug, "google"))
    .limit(1);

  if (!google) {
    console.error("Google provider not found!");
    process.exit(1);
  }

  // Models to remove (outdated or non-existent)
  const googleToRemove = [
    "gemini-2-0-pro",
    "gemini-3-1-pro",  // Non-existent
    "gemini-3-flash",  // Non-existent
  ];

  // Models to add (current frontier - verified to exist)
  const googleToAdd = [
    // 3 series (preview — latest)
    { slug: "gemini-3-1-pro", name: "Gemini 3.1 Pro" },
    { slug: "gemini-3-flash", name: "Gemini 3 Flash" },
    // 2.5 series (stable)
    { slug: "gemini-2-5-pro", name: "Gemini 2.5 Pro" },
    { slug: "gemini-2-5-flash", name: "Gemini 2.5 Flash" },
    { slug: "gemini-2-5-flash-lite", name: "Gemini 2.5 Flash-Lite" },
  ];

  console.log("\nRemoving outdated models:");
  for (const slug of googleToRemove) {
    const result = await db
      .delete(models)
      .where(and(eq(models.slug, slug), eq(models.providerId, google.id)))
      .returning({ slug: models.slug });

    if (result.length > 0) {
      console.log(`  ✗ Removed: ${slug}`);
    } else {
      console.log(`  - Not found: ${slug}`);
    }
  }

  console.log("\nAdding/updating models:");
  for (const model of googleToAdd) {
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
      providerId: google.id,
      isActive: true,
    });
    console.log(`  ✓ Added: ${model.slug} (${model.name})`);
  }

  // List final Google models
  console.log("\nFinal Google models:");
  const finalGoogle = await db
    .select({ slug: models.slug, name: models.name })
    .from(models)
    .where(eq(models.providerId, google.id))
    .orderBy(models.name);

  for (const m of finalGoogle) {
    console.log(`  - ${m.slug}: ${m.name}`);
  }
  console.log(`Total: ${finalGoogle.length} Google models`);

  console.log("\n" + "=".repeat(60));
  console.log("DONE");
  console.log("=".repeat(60));

  process.exit(0);
}

main().catch(console.error);
