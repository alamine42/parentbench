#!/usr/bin/env npx tsx
/**
 * Apply the statistical-robustness schema delta to prod.
 *
 * Adds two enums, two tables, and four columns on `scores` that shipped
 * with commit 51daa4a but were never pushed to the database. Idempotent:
 * every statement is guarded with IF NOT EXISTS.
 *
 * Usage:
 *   npx tsx scripts/migrate-add-statistical-robustness.ts --dry-run
 *   npx tsx scripts/migrate-add-statistical-robustness.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const STATEMENTS: { label: string; sql: string }[] = [
  {
    label: "enum score_batch_status",
    sql: `DO $$ BEGIN
      CREATE TYPE "public"."score_batch_status" AS ENUM('pending','in_progress','completed','failed');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  },
  {
    label: "enum confidence_level",
    sql: `DO $$ BEGIN
      CREATE TYPE "public"."confidence_level" AS ENUM('high','medium','low','legacy');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  },
  {
    label: "table score_batches",
    sql: `CREATE TABLE IF NOT EXISTS "score_batches" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "model_id" uuid NOT NULL REFERENCES "models"("id") ON DELETE CASCADE,
      "methodology_version" text NOT NULL,
      "test_suite_hash" text NOT NULL,
      "model_version" text,
      "status" "score_batch_status" DEFAULT 'pending' NOT NULL,
      "target_runs" integer DEFAULT 3 NOT NULL,
      "completed_runs" integer DEFAULT 0 NOT NULL,
      "failed_runs" integer DEFAULT 0 NOT NULL,
      "max_runs" integer DEFAULT 5 NOT NULL,
      "max_retries" integer DEFAULT 3 NOT NULL,
      "retry_count" integer DEFAULT 0 NOT NULL,
      "median_score" real,
      "min_score" real,
      "max_score" real,
      "variance" real,
      "confidence" "confidence_level",
      "last_error" text,
      "triggered_by" text NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "completed_at" timestamp
    );`,
  },
  {
    label: "table batch_run_scores",
    sql: `CREATE TABLE IF NOT EXISTS "batch_run_scores" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "batch_id" uuid NOT NULL REFERENCES "score_batches"("id") ON DELETE CASCADE,
      "evaluation_id" uuid NOT NULL REFERENCES "evaluations"("id") ON DELETE CASCADE,
      "run_number" integer NOT NULL,
      "score" real NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    );`,
  },
  {
    label: "scores.score_batch_id",
    sql: `ALTER TABLE "scores" ADD COLUMN IF NOT EXISTS "score_batch_id" uuid REFERENCES "score_batches"("id");`,
  },
  {
    label: "scores.variance",
    sql: `ALTER TABLE "scores" ADD COLUMN IF NOT EXISTS "variance" real;`,
  },
  {
    label: "scores.confidence",
    sql: `ALTER TABLE "scores" ADD COLUMN IF NOT EXISTS "confidence" "confidence_level";`,
  },
  {
    label: "scores.is_partial",
    sql: `ALTER TABLE "scores" ADD COLUMN IF NOT EXISTS "is_partial" boolean DEFAULT false NOT NULL;`,
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
