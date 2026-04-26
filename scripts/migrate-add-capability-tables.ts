#!/usr/bin/env npx tsx
/**
 * Apply the capability-decorrelation schema delta (parentbench-rg1.1).
 *
 * Adds one enum + two tables. Idempotent: every statement is guarded
 * with IF NOT EXISTS / duplicate_object handling.
 *
 * Usage:
 *   npx tsx scripts/migrate-add-capability-tables.ts --dry-run
 *   npx tsx scripts/migrate-add-capability-tables.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const STATEMENTS: { label: string; sql: string }[] = [
  {
    label: "enum capability_benchmark",
    sql: `DO $$ BEGIN
      CREATE TYPE "public"."capability_benchmark" AS ENUM('mmlu','gsm8k','gpqa');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  },
  {
    label: "table model_capability_scores",
    sql: `CREATE TABLE IF NOT EXISTS "model_capability_scores" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "model_id" uuid NOT NULL REFERENCES "models"("id") ON DELETE CASCADE,
      "benchmark" "capability_benchmark" NOT NULL,
      "score" real NOT NULL,
      "shot_setting" text,
      "benchmark_variant" text,
      "source_url" text NOT NULL,
      "source_note" text,
      "recorded_at" timestamp DEFAULT now() NOT NULL,
      "recorded_by" text NOT NULL,
      "superseded_at" timestamp
    );`,
  },
  {
    label: "index idx_capability_live (live row lookup)",
    sql: `CREATE INDEX IF NOT EXISTS "idx_capability_live"
          ON "model_capability_scores" ("model_id", "benchmark")
          WHERE "superseded_at" IS NULL;`,
  },
  {
    label: "table correlation_reports",
    sql: `CREATE TABLE IF NOT EXISTS "correlation_reports" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "computed_at" timestamp DEFAULT now() NOT NULL,
      "spearman_rho" real NOT NULL,
      "spearman_rho_abs" real NOT NULL,
      "model_count" integer NOT NULL,
      "benchmarks_used" jsonb NOT NULL,
      "per_model_scores" jsonb NOT NULL,
      "methodology_version" text NOT NULL
    );`,
  },
  {
    label: "index idx_correlation_recent",
    sql: `CREATE INDEX IF NOT EXISTS "idx_correlation_recent"
          ON "correlation_reports" ("computed_at" DESC);`,
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

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
