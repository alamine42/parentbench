#!/usr/bin/env npx tsx
/**
 * Apply the benign-evaluation schema delta (parentbench-rg3.2).
 *
 * - New enum test_case_kind ('safety' | 'benign')
 * - New value 'answer' on existing expected_behavior enum
 * - test_cases.kind column (default 'safety' for back-compat)
 * - 5 nullable columns on scores: false_refusal_rate, net_helpfulness,
 *   benign_refusal_count, benign_total_count, refused_benign_case_ids
 *
 * Idempotent. ALTER TYPE ADD VALUE runs outside an explicit transaction
 * (Postgres limitation) — we issue each statement as its own implicit
 * transaction.
 *
 * Usage:
 *   npx tsx scripts/migrate-add-benign-evaluation.ts --dry-run
 *   npx tsx scripts/migrate-add-benign-evaluation.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const STATEMENTS: { label: string; sql: string }[] = [
  {
    label: "enum test_case_kind",
    sql: `DO $$ BEGIN
      CREATE TYPE "public"."test_case_kind" AS ENUM('safety','benign');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  },
  {
    label: "enum expected_behavior — add 'answer'",
    sql: `ALTER TYPE "public"."expected_behavior" ADD VALUE IF NOT EXISTS 'answer';`,
  },
  {
    label: "test_cases.kind column",
    sql: `ALTER TABLE "test_cases"
          ADD COLUMN IF NOT EXISTS "kind" "test_case_kind" DEFAULT 'safety' NOT NULL;`,
  },
  {
    label: "test_cases.category_id — drop NOT NULL (benign cases have no category)",
    sql: `ALTER TABLE "test_cases" ALTER COLUMN "category_id" DROP NOT NULL;`,
  },
  {
    label: "scores.false_refusal_rate",
    sql: `ALTER TABLE "scores" ADD COLUMN IF NOT EXISTS "false_refusal_rate" real;`,
  },
  {
    label: "scores.net_helpfulness",
    sql: `ALTER TABLE "scores" ADD COLUMN IF NOT EXISTS "net_helpfulness" real;`,
  },
  {
    label: "scores.benign_refusal_count",
    sql: `ALTER TABLE "scores" ADD COLUMN IF NOT EXISTS "benign_refusal_count" integer;`,
  },
  {
    label: "scores.benign_total_count",
    sql: `ALTER TABLE "scores" ADD COLUMN IF NOT EXISTS "benign_total_count" integer;`,
  },
  {
    label: "scores.refused_benign_case_ids",
    sql: `ALTER TABLE "scores" ADD COLUMN IF NOT EXISTS "refused_benign_case_ids" jsonb;`,
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
