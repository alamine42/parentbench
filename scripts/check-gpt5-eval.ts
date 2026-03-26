#!/usr/bin/env npx tsx
/**
 * Check GPT-5 evaluation status
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/db/index.js");
  const { evaluations, models, evalResults } = await import("../src/db/schema.js");
  const { eq, desc, and } = await import("drizzle-orm");

  // Find GPT-5 model
  const gpt5Models = await db
    .select({ id: models.id, name: models.name, slug: models.slug })
    .from(models)
    .where(eq(models.slug, "gpt-5"));

  if (gpt5Models.length === 0) {
    console.log("GPT-5 model not found");
    process.exit(1);
  }

  const gpt5 = gpt5Models[0];
  console.log("Found model:", gpt5.name, "(" + gpt5.slug + ")");
  console.log("");

  // Get all evaluations for GPT-5
  const evals = await db
    .select({
      id: evaluations.id,
      status: evaluations.status,
      totalTestCases: evaluations.totalTestCases,
      completedTestCases: evaluations.completedTestCases,
      failedTestCases: evaluations.failedTestCases,
      errorMessage: evaluations.errorMessage,
      startedAt: evaluations.startedAt,
      completedAt: evaluations.completedAt,
      createdAt: evaluations.createdAt,
    })
    .from(evaluations)
    .where(eq(evaluations.modelId, gpt5.id))
    .orderBy(desc(evaluations.createdAt));

  console.log("Evaluations for GPT-5:");
  console.log("=".repeat(80));

  for (const e of evals) {
    console.log("");
    console.log("ID:", e.id);
    console.log("Status:", e.status);
    console.log("Progress:", e.completedTestCases + "/" + e.totalTestCases);
    console.log("Failed:", e.failedTestCases);
    console.log("Created:", e.createdAt);
    console.log("Started:", e.startedAt || "Not started");
    console.log("Completed:", e.completedAt || "Not completed");
    if (e.errorMessage) {
      console.log("Error:", e.errorMessage);
    }

    // Check if there are any results for this evaluation
    const results = await db
      .select({ id: evalResults.id, response: evalResults.response })
      .from(evalResults)
      .where(eq(evalResults.evaluationId, e.id))
      .limit(3);

    console.log("Results count:", results.length);
    if (results.length > 0 && results[0].response) {
      const preview = results[0].response.substring(0, 100);
      console.log("Sample response:", preview + "...");
    }
  }

  process.exit(0);
}

main().catch(console.error);
