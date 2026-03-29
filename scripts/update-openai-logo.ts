/**
 * Update OpenAI provider logo URL in database
 * Run with: npx tsx scripts/update-openai-logo.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL environment variable is required");
    process.exit(1);
  }

  console.log("🔄 Updating OpenAI provider logo...\n");

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql, { schema });

  try {
    const result = await db
      .update(schema.providers)
      .set({ logoUrl: "/assets/openai_logo.png" })
      .where(eq(schema.providers.slug, "openai"))
      .returning({ id: schema.providers.id, name: schema.providers.name });

    if (result.length > 0) {
      console.log(`✅ Updated logo for provider: ${result[0].name}`);
    } else {
      console.log("⚠️ No OpenAI provider found in database");
    }
  } catch (error) {
    console.error("❌ Update failed:", error);
    process.exit(1);
  }
}

main();
