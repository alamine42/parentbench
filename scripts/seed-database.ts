/**
 * Seed Database Script
 *
 * Migrates existing data from JSON files to Postgres database.
 * Run with: npm run db:seed
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/db/schema";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");

interface JsonModel {
  slug: string;
  name: string;
  provider: {
    name: string;
    slug: string;
    logo: string;
  };
  releaseDate: string;
  parameterCount: string | null;
  overallScore: number;
  overallGrade: string;
  categoryScores: Record<string, number>;
  evaluatedDate: string;
  dataQuality: string;
}

interface JsonTestCase {
  id: string;
  category: string;
  prompt: string;
  expectedBehavior: string;
  severity: string;
  description: string;
  examples?: Array<{
    type: string;
    response: string;
    explanation: string;
  }>;
}

interface JsonScore {
  modelSlug: string;
  overallScore: number;
  overallGrade: string;
  trend: string;
  categoryScores: Array<{
    category: string;
    score: number;
    grade: string;
    passRate: number;
    testCount: number;
  }>;
  evaluatedDate: string;
  dataQuality: string;
  methodologyVersion: string;
}

interface JsonMethodology {
  version: string;
  name: string;
  description: string;
  categoryWeights: Record<string, number>;
  testCaseCounts: Record<string, number>;
  scoringApproach: string;
  limitations: string[];
  lastUpdated: string;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL environment variable is required");
    console.error("   Please set it in .env.local");
    process.exit(1);
  }

  console.log("🌱 Starting database seed...\n");

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql, { schema });

  try {
    // 1. Load JSON data
    console.log("📁 Loading JSON data...");

    const modelsRaw = await fs.readFile(path.join(DATA_DIR, "models.json"), "utf-8");
    const modelsData = JSON.parse(modelsRaw) as { models: JsonModel[] };

    const testCasesRaw = await fs.readFile(path.join(DATA_DIR, "parentbench", "test-cases.json"), "utf-8");
    const testCasesData = JSON.parse(testCasesRaw) as { testCases: JsonTestCase[] };

    const scoresRaw = await fs.readFile(path.join(DATA_DIR, "parentbench", "scores.json"), "utf-8");
    const scoresData = JSON.parse(scoresRaw) as { results: JsonScore[] };

    const methodologyRaw = await fs.readFile(path.join(DATA_DIR, "parentbench", "methodology.json"), "utf-8");
    const methodologyData = JSON.parse(methodologyRaw) as JsonMethodology;

    console.log(`   Found ${modelsData.models.length} models`);
    console.log(`   Found ${testCasesData.testCases.length} test cases`);
    console.log(`   Found ${scoresData.results.length} scores`);

    // 2. Seed categories
    console.log("\n📦 Seeding categories...");

    const categoryMeta: Record<string, { label: string; question: string; description: string; icon: string }> = {
      age_inappropriate_content: {
        label: "Age-Inappropriate Content",
        question: "Will it show my kid violent or adult content?",
        description: "Tests whether the model refuses to generate violent, sexual, or substance-related content when interacting with minors.",
        icon: "shield-check",
      },
      manipulation_resistance: {
        label: "Manipulation Resistance",
        question: "Can someone use it to groom or manipulate my child?",
        description: "Evaluates whether the model resists grooming tactics, emotional manipulation, and peer pressure scenarios.",
        icon: "user-shield",
      },
      data_privacy_minors: {
        label: "Data Privacy for Minors",
        question: "Will it try to get my child's personal information?",
        description: "Checks if the model protects children's personal data by refusing to collect or store identifying information.",
        icon: "lock",
      },
      parental_controls_respect: {
        label: "Parental Controls Respect",
        question: "Will it help my kid bypass screen time or content filters?",
        description: "Tests whether the model refuses to help circumvent parental controls, screen time limits, or age restrictions.",
        icon: "home",
      },
    };

    const categoryIds: Record<string, string> = {};

    for (const [name, meta] of Object.entries(categoryMeta)) {
      const id = randomUUID();
      categoryIds[name] = id;

      await db.insert(schema.categories).values({
        id,
        name: name as "age_inappropriate_content" | "manipulation_resistance" | "data_privacy_minors" | "parental_controls_respect",
        label: meta.label,
        question: meta.question,
        description: meta.description,
        icon: meta.icon,
        weight: methodologyData.categoryWeights[name] || 0.25,
      }).onConflictDoNothing();
    }
    console.log(`   ✓ Seeded ${Object.keys(categoryMeta).length} categories`);

    // 3. Seed providers
    console.log("\n📦 Seeding providers...");

    const uniqueProviders = new Map<string, JsonModel["provider"]>();
    for (const model of modelsData.models) {
      if (!uniqueProviders.has(model.provider.slug)) {
        uniqueProviders.set(model.provider.slug, model.provider);
      }
    }

    const providerIds: Record<string, string> = {};

    for (const [slug, provider] of uniqueProviders) {
      const id = randomUUID();
      providerIds[slug] = id;

      await db.insert(schema.providers).values({
        id,
        name: provider.name,
        slug: provider.slug,
        logoUrl: provider.logo,
      }).onConflictDoNothing();
    }
    console.log(`   ✓ Seeded ${uniqueProviders.size} providers`);

    // 4. Seed models
    console.log("\n📦 Seeding models...");

    const modelIds: Record<string, string> = {};

    for (const model of modelsData.models) {
      const id = randomUUID();
      modelIds[model.slug] = id;

      await db.insert(schema.models).values({
        id,
        providerId: providerIds[model.provider.slug],
        name: model.name,
        slug: model.slug,
        releaseDate: model.releaseDate ? new Date(model.releaseDate) : null,
        parameterCount: model.parameterCount,
        capabilities: [],
        isActive: true,
      }).onConflictDoNothing();
    }
    console.log(`   ✓ Seeded ${modelsData.models.length} models`);

    // 5. Seed test cases
    console.log("\n📦 Seeding test cases...");

    for (const testCase of testCasesData.testCases) {
      const categoryId = categoryIds[testCase.category];
      if (!categoryId) {
        console.warn(`   ⚠ Unknown category: ${testCase.category}`);
        continue;
      }

      await db.insert(schema.testCases).values({
        id: randomUUID(),
        categoryId,
        prompt: testCase.prompt,
        expectedBehavior: testCase.expectedBehavior as "refuse" | "safe_response" | "redirect",
        severity: testCase.severity as "critical" | "high" | "medium",
        description: testCase.description,
        ageBrackets: ["6-9", "10-12", "13-15"],
        modality: "text",
        isActive: true,
      }).onConflictDoNothing();
    }
    console.log(`   ✓ Seeded ${testCasesData.testCases.length} test cases`);

    // 6. Seed scores
    console.log("\n📦 Seeding scores...");

    for (const score of scoresData.results) {
      const modelId = modelIds[score.modelSlug];
      if (!modelId) {
        console.warn(`   ⚠ Unknown model: ${score.modelSlug}`);
        continue;
      }

      await db.insert(schema.scores).values({
        id: randomUUID(),
        modelId,
        overallScore: score.overallScore,
        overallGrade: score.overallGrade as typeof schema.letterGradeEnum.enumValues[number],
        trend: score.trend as "up" | "down" | "stable" | "new",
        dataQuality: score.dataQuality as "verified" | "partial" | "estimated",
        categoryScores: score.categoryScores,
        computedAt: new Date(score.evaluatedDate),
      }).onConflictDoNothing();
    }
    console.log(`   ✓ Seeded ${scoresData.results.length} scores`);

    // 7. Create admin user
    console.log("\n📦 Creating admin user...");

    await db.insert(schema.users).values({
      id: randomUUID(),
      email: "admin@parentbench.org",
      role: "admin",
      emailVerified: true,
    }).onConflictDoNothing();
    console.log("   ✓ Created admin user");

    console.log("\n✅ Database seed completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`   - ${Object.keys(categoryMeta).length} categories`);
    console.log(`   - ${uniqueProviders.size} providers`);
    console.log(`   - ${modelsData.models.length} models`);
    console.log(`   - ${testCasesData.testCases.length} test cases`);
    console.log(`   - ${scoresData.results.length} scores`);

  } catch (error) {
    console.error("\n❌ Seed failed:", error);
    process.exit(1);
  }
}

main();
