#!/usr/bin/env npx tsx
/**
 * Fix stuck evaluations that are marked as "running" but failed in Inngest
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/db/index.js");
  const { evaluations, models } = await import("../src/db/schema.js");
  const { eq, and, lt } = await import("drizzle-orm");

  // Find evaluations that have been "running" for more than 30 minutes
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  const stuckEvals = await db
    .select({
      id: evaluations.id,
      status: evaluations.status,
      modelId: evaluations.modelId,
      completedTestCases: evaluations.completedTestCases,
      totalTestCases: evaluations.totalTestCases,
      startedAt: evaluations.startedAt,
    })
    .from(evaluations)
    .where(
      and(
        eq(evaluations.status, "running"),
        lt(evaluations.startedAt, thirtyMinutesAgo)
      )
    );

  if (stuckEvals.length === 0) {
    console.log("No stuck evaluations found.");
    process.exit(0);
  }

  console.log("Found", stuckEvals.length, "stuck evaluation(s):\n");

  // Get model names
  const modelList = await db.select({ id: models.id, name: models.name }).from(models);
  const modelMap: Record<string, string> = {};
  for (const m of modelList) {
    modelMap[m.id] = m.name;
  }

  for (const e of stuckEvals) {
    const modelName = modelMap[e.modelId] || "Unknown";
    console.log("- " + modelName + " (" + e.id.substring(0, 8) + ")");
    console.log("  Progress: " + e.completedTestCases + "/" + e.totalTestCases);
    console.log("  Started: " + e.startedAt);

    // Mark as failed
    await db
      .update(evaluations)
      .set({
        status: "failed",
        errorMessage: "Evaluation timed out or crashed in background job",
        completedAt: new Date(),
      })
      .where(eq(evaluations.id, e.id));

    console.log("  -> Marked as FAILED\n");
  }

  console.log("Done. Fixed", stuckEvals.length, "evaluation(s).");
  process.exit(0);
}

main().catch(console.error);
