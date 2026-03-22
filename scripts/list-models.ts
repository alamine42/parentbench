#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/db/index.js");
  const { models, providers } = await import("../src/db/schema.js");
  const { eq } = await import("drizzle-orm");

  const allModels = await db
    .select({
      slug: models.slug,
      name: models.name,
      providerName: providers.name,
      isActive: models.isActive,
    })
    .from(models)
    .leftJoin(providers, eq(models.providerId, providers.id))
    .orderBy(providers.name, models.name);

  console.log("Current models in database:\n");
  console.log("Slug                    | Name                      | Provider    | Active");
  console.log("-".repeat(80));
  for (const m of allModels) {
    const slug = m.slug.padEnd(23);
    const name = (m.name || "").padEnd(25);
    const provider = (m.providerName || "").padEnd(11);
    console.log(`${slug} | ${name} | ${provider} | ${m.isActive ? "✓" : "✗"}`);
  }
  console.log(`\nTotal: ${allModels.length} models`);
  process.exit(0);
}

main().catch(console.error);
