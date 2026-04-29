#!/usr/bin/env npx tsx
/**
 * Deactivate o4-mini ahead of OpenAI's 2026-10-23 API shutdown
 * (parentbench-eie). The DB row is preserved (is_active=false) so
 * historical scores referencing it remain intact; the admin UI
 * filters models.is_active=true on the run-eval picker, so this
 * is sufficient to prevent new evals from being scheduled against
 * a soon-to-be-dead endpoint.
 *
 * Idempotent — safe to run more than once.
 *
 * Usage:
 *   npx tsx scripts/deactivate-o4-mini.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/db/index.js");
  const { models } = await import("../src/db/schema.js");
  const { eq } = await import("drizzle-orm");

  const [row] = await db
    .select({ id: models.id, slug: models.slug, isActive: models.isActive })
    .from(models)
    .where(eq(models.slug, "o4-mini"))
    .limit(1);

  if (!row) {
    console.log("o4-mini row not found — nothing to do.");
    process.exit(0);
  }

  if (!row.isActive) {
    console.log(`o4-mini already inactive (id=${row.id}). No change.`);
    process.exit(0);
  }

  await db
    .update(models)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(models.id, row.id));

  console.log(`✓ Deactivated o4-mini (id=${row.id}). Historical scores preserved.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
