#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/db/index.js");
  const { scores } = await import("../src/db/schema.js");
  const { eq } = await import("drizzle-orm");

  // Delete scores with 0 overall score (failed evaluations)
  const deleted = await db
    .delete(scores)
    .where(eq(scores.overallScore, 0))
    .returning({ id: scores.id });

  console.log(`Deleted ${deleted.length} failed evaluation scores`);
  process.exit(0);
}
main().catch(console.error);
