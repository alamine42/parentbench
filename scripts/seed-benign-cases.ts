#!/usr/bin/env npx tsx
/**
 * Seed benign cases from data/parentbench/benign-cases.json into the
 * test_cases table (parentbench-rg3.1).
 *
 * Each case is inserted as: kind='benign', categoryId=null,
 * expectedBehavior='answer', isActive=true.
 *
 * Idempotent on `prompt`: if a benign row with the same prompt already
 * exists in the DB, it's skipped.
 *
 * Usage:
 *   npx tsx scripts/seed-benign-cases.ts --dry-run
 *   npx tsx scripts/seed-benign-cases.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "fs";

type BenignCase = {
  id: string;
  category: string;
  prompt: string;
  ageBracket: string;
  rationale: string;
};

const BENIGN_FILE = "data/parentbench/benign-cases.json";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(dryRun ? "DRY RUN — no DB writes\n" : "APPLYING\n");

  const { db } = await import("../src/db/index.js");
  const { testCases } = await import("../src/db/schema.js");
  const { eq, and } = await import("drizzle-orm");

  const data = JSON.parse(readFileSync(BENIGN_FILE, "utf8")) as { cases: BenignCase[] };
  console.log(`Found ${data.cases.length} benign cases in JSON.\n`);

  const existing = await db
    .select({ prompt: testCases.prompt })
    .from(testCases)
    .where(eq(testCases.kind, "benign"));
  const existingPrompts = new Set(existing.map((r) => r.prompt));

  let inserted = 0;
  let skipped = 0;
  for (const c of data.cases) {
    if (existingPrompts.has(c.prompt)) {
      console.log(`SKIP   ${c.id.padEnd(8)} ${c.category.padEnd(14)} (live row exists)`);
      skipped++;
      continue;
    }
    console.log(`INSERT ${c.id.padEnd(8)} ${c.category.padEnd(14)} "${c.prompt.slice(0, 60)}..."`);
    if (!dryRun) {
      await db.insert(testCases).values({
        categoryId: null,
        kind: "benign",
        prompt: c.prompt,
        expectedBehavior: "answer",
        severity: "medium",
        description: `Benign case ${c.id} (${c.category}). ${c.rationale}`,
        ageBrackets: [c.ageBracket],
        modality: "text",
        isActive: true,
      });
    }
    inserted++;
  }

  console.log(`\nSeed: inserted=${inserted}, skipped=${skipped}`);
  console.log(dryRun ? "\nDry run complete — re-run without --dry-run to apply." : "\n✅ Seed applied.");

  // Sanity: count active benign rows in DB
  if (!dryRun) {
    const active = await db
      .select({ id: testCases.id })
      .from(testCases)
      .where(and(eq(testCases.kind, "benign"), eq(testCases.isActive, true)));
    console.log(`Active benign rows in DB now: ${active.length}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
