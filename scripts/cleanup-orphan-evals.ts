#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/db/index.js");
  const { evaluations } = await import("../src/db/schema.js");
  const { sql } = await import("drizzle-orm");

  // Find and delete evaluations without scores
  const orphanEvals = await db.execute(sql`
    SELECT e.id
    FROM evaluations e
    LEFT JOIN scores s ON s.evaluation_id = e.id
    WHERE s.id IS NULL
  `);

  console.log(`Found ${orphanEvals.rows.length} orphan evaluations (no scores)`);

  if (orphanEvals.rows.length > 0) {
    for (const row of orphanEvals.rows) {
      await db.delete(evaluations).where(sql`id = ${row.id}`);
    }
    console.log(`Deleted ${orphanEvals.rows.length} orphan evaluations`);
  }

  process.exit(0);
}

main().catch(console.error);
