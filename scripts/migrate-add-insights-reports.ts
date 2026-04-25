#!/usr/bin/env npx tsx
/**
 * Apply the insights_reports schema delta (parentbench-ov1).
 *
 * Adds two enums and the `insights_reports` table. Idempotent: every
 * statement is guarded with IF NOT EXISTS / duplicate_object handling.
 *
 * Usage:
 *   npx tsx scripts/migrate-add-insights-reports.ts --dry-run
 *   npx tsx scripts/migrate-add-insights-reports.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const STATEMENTS: { label: string; sql: string }[] = [
  {
    label: "enum insights_report_status",
    sql: `DO $$ BEGIN
      CREATE TYPE "public"."insights_report_status" AS ENUM(
        'draft','generation_failed','published','retracted'
      );
    EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  },
  {
    label: "enum insights_trigger_reason",
    sql: `DO $$ BEGIN
      CREATE TYPE "public"."insights_trigger_reason" AS ENUM(
        'score_delta','new_model','active_tier_promoted','manual','scheduled_recheck'
      );
    EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  },
  {
    label: "table insights_reports",
    sql: `CREATE TABLE IF NOT EXISTS "insights_reports" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "slug" text NOT NULL UNIQUE,
      "generated_at" timestamp DEFAULT now() NOT NULL,
      "data_through" timestamp NOT NULL,
      "aggregates" jsonb NOT NULL,
      "narrative" jsonb,
      "failure_reason" text,
      "generator_model" text NOT NULL,
      "generator_cost_usd" real,
      "generator_tokens_in" integer,
      "generator_tokens_out" integer,
      "trigger_reason" "insights_trigger_reason" NOT NULL,
      "triggering_event" jsonb,
      "status" "insights_report_status" DEFAULT 'draft' NOT NULL,
      "published_at" timestamp,
      "retracted_at" timestamp,
      "retracted_reason" text
    );`,
  },
  {
    label: "index idx_insights_status_generated",
    sql: `CREATE INDEX IF NOT EXISTS "idx_insights_status_generated"
          ON "insights_reports" ("status", "generated_at" DESC);`,
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
