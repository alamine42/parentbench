#!/usr/bin/env npx tsx
/**
 * Migration: add `surface` text column to `evaluations` and `scores`
 * (parentbench-4tz).
 *
 * Existing rows auto-backfill to 'api-default' via the column DEFAULT.
 * The composite index on `scores (surface, model_id, computed_at DESC)`
 * is shaped for the leaderboard tab query: "for each (model, surface),
 * give me the most recent score."
 *
 * Idempotent: every statement uses IF NOT EXISTS or duplicate_object.
 *
 * Usage:
 *   npx tsx scripts/migrate-add-surface-column.ts --dry-run
 *   npx tsx scripts/migrate-add-surface-column.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

export const STATEMENTS: { label: string; sql: string }[] = [
  {
    label: "evaluations.surface",
    sql: `ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "surface" text NOT NULL DEFAULT 'api-default';`,
  },
  {
    label: "scores.surface",
    sql: `ALTER TABLE "scores" ADD COLUMN IF NOT EXISTS "surface" text NOT NULL DEFAULT 'api-default';`,
  },
  {
    label: "idx_scores_surface_model",
    sql: `CREATE INDEX IF NOT EXISTS "idx_scores_surface_model" ON "scores" ("surface", "model_id", "computed_at" DESC);`,
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
      await db.execute(sql.raw(stmt));
    }
  }

  console.log(dryRun ? "\nDry run complete." : "\n✅ Migration applied.");
  process.exit(0);
}

// Only run main() when executed directly. Importing the module (e.g. from
// tests) just exposes STATEMENTS without side effects.
const isMain =
  typeof require !== "undefined" && typeof module !== "undefined"
    ? require.main === module
    : false;
const isTsxEntry =
  typeof process !== "undefined" &&
  process.argv[1] &&
  process.argv[1].endsWith("migrate-add-surface-column.ts");

if (isMain || isTsxEntry) {
  main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
