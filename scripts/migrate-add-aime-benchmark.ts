#!/usr/bin/env npx tsx
/**
 * Add 'aime_2025' to the capability_benchmark enum
 * (parentbench-rg1.2 follow-up).
 *
 * GSM8K is near-saturated for frontier models — providers no longer
 * publish it on flagship releases. AIME 2025 replaces it as the math
 * discriminator. We don't drop 'gsm8k' from the enum because Postgres
 * enum-value drops are destructive; we just stop accepting it via
 * CAPABILITY_BENCHMARKS in validation.ts.
 *
 * Usage:
 *   npx tsx scripts/migrate-add-aime-benchmark.ts --dry-run
 *   npx tsx scripts/migrate-add-aime-benchmark.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const STATEMENTS: { label: string; sql: string }[] = [
  {
    label: "enum capability_benchmark — add 'aime_2025'",
    sql: `ALTER TYPE "public"."capability_benchmark" ADD VALUE IF NOT EXISTS 'aime_2025';`,
  },
];

async function main() {
  const { db } = await import("../src/db/index.js");
  const { sql } = await import("drizzle-orm");

  const dryRun = process.argv.includes("--dry-run");
  console.log(dryRun ? "DRY RUN — no changes\n" : "APPLYING\n");

  for (const { label, sql: stmt } of STATEMENTS) {
    console.log(`• ${label}`);
    if (!dryRun) {
      // ALTER TYPE ... ADD VALUE cannot run inside an explicit transaction
      // block in Postgres. db.execute() runs a single statement which is
      // implicitly auto-committed — no transaction wrapper needed.
      await db.execute(sql.raw(stmt));
    }
  }

  console.log(dryRun ? "\nDry run complete." : "\n✅ Migration applied.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
