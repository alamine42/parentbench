/**
 * Data Validation Script
 *
 * Checks consistency between models.json and individual score files.
 * Run with: npx tsx scripts/validate-data.ts
 */

import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const MODELS_FILE = path.join(DATA_DIR, "models.json");
const SCORES_DIR = path.join(DATA_DIR, "scores");
const PARENTBENCH_DIR = path.join(DATA_DIR, "parentbench");
const PARENTBENCH_SCORES_FILE = path.join(PARENTBENCH_DIR, "scores.json");
const PARENTBENCH_TESTCASES_FILE = path.join(PARENTBENCH_DIR, "test-cases.json");
const PARENTBENCH_METHODOLOGY_FILE = path.join(PARENTBENCH_DIR, "methodology.json");

const SAFETY_CATEGORIES = [
  "honesty",
  "fairness",
  "refusal_to_harm",
  "manipulation_resistance",
  "privacy_respect",
  "straight_talk",
] as const;

const VALID_GRADES = [
  "A+", "A", "A-",
  "B+", "B", "B-",
  "C+", "C", "C-",
  "D+", "D", "D-",
  "F",
];

const VALID_TRENDS = ["up", "down", "stable", "new"];

const VALID_DATA_QUALITIES = ["verified", "partial", "estimated"];

const PARENTBENCH_CATEGORIES = [
  "age_inappropriate_content",
  "manipulation_resistance",
  "data_privacy_minors",
  "parental_controls_respect",
] as const;

const VALID_EXPECTED_BEHAVIORS = ["refuse", "safe_response", "redirect"];
const VALID_SEVERITIES = ["critical", "high", "medium"];

type ValidationError = {
  type: "error" | "warning";
  model: string;
  message: string;
};

const errors: ValidationError[] = [];

function addError(model: string, message: string) {
  errors.push({ type: "error", model, message });
}

function addWarning(model: string, message: string) {
  errors.push({ type: "warning", model, message });
}

function scoreToExpectedGrade(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 63) return "D";
  if (score >= 60) return "D-";
  return "F";
}

function validateModelsJson(data: unknown): data is { lastUpdated: string; models: unknown[] } {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.lastUpdated !== "string") return false;
  if (!Array.isArray(obj.models)) return false;
  return true;
}

function validateModelEntry(model: unknown, index: number): model is Record<string, unknown> {
  if (typeof model !== "object" || model === null) {
    addError(`models[${index}]`, "Model entry is not an object");
    return false;
  }
  return true;
}

function validateScoreFile(data: unknown, slug: string): data is Record<string, unknown> {
  if (typeof data !== "object" || data === null) {
    addError(slug, "Score file is not a valid JSON object");
    return false;
  }
  return true;
}

function validateParentBenchData(modelSlugs: Set<string>) {
  // Track ParentBench model slugs for cross-reference
  const parentBenchSlugs = new Set<string>();

  // Validate scores.json
  console.log("Checking parentbench/scores.json...");
  if (!fs.existsSync(PARENTBENCH_SCORES_FILE)) {
    addError("parentbench", "scores.json not found");
  } else {
    try {
      const scoresRaw = fs.readFileSync(PARENTBENCH_SCORES_FILE, "utf-8");
      const scoresData = JSON.parse(scoresRaw) as { lastUpdated: string; results: unknown[] };

      if (!scoresData.lastUpdated) {
        addError("parentbench/scores", "Missing lastUpdated field");
      }

      if (!Array.isArray(scoresData.results)) {
        addError("parentbench/scores", "results must be an array");
      } else {
        for (let i = 0; i < scoresData.results.length; i++) {
          const result = scoresData.results[i] as Record<string, unknown>;
          const slug = result.modelSlug as string;

          if (!slug) {
            addError(`parentbench/scores[${i}]`, "Missing modelSlug");
            continue;
          }

          parentBenchSlugs.add(slug);

          // Check model exists in models.json
          if (!modelSlugs.has(slug)) {
            addError(`parentbench/scores/${slug}`, "Model not found in models.json");
          }

          // Validate overall score
          const overallScore = result.overallScore as number;
          if (typeof overallScore !== "number" || overallScore < 0 || overallScore > 100) {
            addError(`parentbench/scores/${slug}`, `Invalid overallScore: ${overallScore}`);
          }

          // Validate overall grade
          const overallGrade = result.overallGrade as string;
          if (!VALID_GRADES.includes(overallGrade)) {
            addError(`parentbench/scores/${slug}`, `Invalid overallGrade: ${overallGrade}`);
          }

          // Validate grade matches score
          const expectedGrade = scoreToExpectedGrade(overallScore);
          if (overallGrade !== expectedGrade) {
            addWarning(`parentbench/scores/${slug}`, `Grade mismatch: got ${overallGrade}, expected ${expectedGrade} for score ${overallScore}`);
          }

          // Validate categoryScores
          const categoryScores = result.categoryScores as unknown[];
          if (!Array.isArray(categoryScores)) {
            addError(`parentbench/scores/${slug}`, "categoryScores must be an array");
          } else {
            if (categoryScores.length !== PARENTBENCH_CATEGORIES.length) {
              addError(`parentbench/scores/${slug}`, `Expected ${PARENTBENCH_CATEGORIES.length} category scores, got ${categoryScores.length}`);
            }

            const foundCategories = new Set<string>();
            for (const catScore of categoryScores) {
              const cat = catScore as Record<string, unknown>;
              const category = cat.category as string;

              if (!PARENTBENCH_CATEGORIES.includes(category as typeof PARENTBENCH_CATEGORIES[number])) {
                addError(`parentbench/scores/${slug}`, `Invalid category: ${category}`);
              } else {
                foundCategories.add(category);
              }

              const score = cat.score as number;
              if (typeof score !== "number" || score < 0 || score > 100) {
                addError(`parentbench/scores/${slug}`, `Invalid ${category} score: ${score}`);
              }

              if (!VALID_GRADES.includes(cat.grade as string)) {
                addError(`parentbench/scores/${slug}`, `Invalid ${category} grade: ${cat.grade}`);
              }
            }

            // Check all categories present
            for (const expectedCat of PARENTBENCH_CATEGORIES) {
              if (!foundCategories.has(expectedCat)) {
                addError(`parentbench/scores/${slug}`, `Missing category: ${expectedCat}`);
              }
            }
          }
        }
      }
    } catch (e) {
      addError("parentbench/scores", `Failed to parse scores.json: ${e}`);
    }
  }

  // Validate test-cases.json
  console.log("Checking parentbench/test-cases.json...");
  if (!fs.existsSync(PARENTBENCH_TESTCASES_FILE)) {
    addError("parentbench", "test-cases.json not found");
  } else {
    try {
      const testCasesRaw = fs.readFileSync(PARENTBENCH_TESTCASES_FILE, "utf-8");
      const testCasesData = JSON.parse(testCasesRaw) as { version: string; lastUpdated: string; testCases: unknown[] };

      if (!testCasesData.version) {
        addError("parentbench/test-cases", "Missing version field");
      }

      if (!testCasesData.lastUpdated) {
        addError("parentbench/test-cases", "Missing lastUpdated field");
      }

      if (!Array.isArray(testCasesData.testCases)) {
        addError("parentbench/test-cases", "testCases must be an array");
      } else {
        const seenIds = new Set<string>();

        for (let i = 0; i < testCasesData.testCases.length; i++) {
          const tc = testCasesData.testCases[i] as Record<string, unknown>;

          // Check for duplicate IDs
          const id = tc.id as string;
          if (!id) {
            addError(`parentbench/test-cases[${i}]`, "Missing id");
          } else if (seenIds.has(id)) {
            addError(`parentbench/test-cases/${id}`, "Duplicate test case ID");
          } else {
            seenIds.add(id);
          }

          // Validate required fields
          if (!tc.category) {
            addError(`parentbench/test-cases/${id || i}`, "Missing category");
          } else if (!PARENTBENCH_CATEGORIES.includes(tc.category as typeof PARENTBENCH_CATEGORIES[number])) {
            addError(`parentbench/test-cases/${id || i}`, `Invalid category: ${tc.category}`);
          }

          if (!tc.prompt || typeof tc.prompt !== "string") {
            addError(`parentbench/test-cases/${id || i}`, "Missing or invalid prompt");
          }

          if (!tc.expectedBehavior) {
            addError(`parentbench/test-cases/${id || i}`, "Missing expectedBehavior");
          } else if (!VALID_EXPECTED_BEHAVIORS.includes(tc.expectedBehavior as string)) {
            addError(`parentbench/test-cases/${id || i}`, `Invalid expectedBehavior: ${tc.expectedBehavior}`);
          }

          if (!tc.severity) {
            addError(`parentbench/test-cases/${id || i}`, "Missing severity");
          } else if (!VALID_SEVERITIES.includes(tc.severity as string)) {
            addError(`parentbench/test-cases/${id || i}`, `Invalid severity: ${tc.severity}`);
          }

          if (!tc.description || typeof tc.description !== "string") {
            addError(`parentbench/test-cases/${id || i}`, "Missing or invalid description");
          }
        }
      }
    } catch (e) {
      addError("parentbench/test-cases", `Failed to parse test-cases.json: ${e}`);
    }
  }

  // Validate methodology.json
  console.log("Checking parentbench/methodology.json...");
  if (!fs.existsSync(PARENTBENCH_METHODOLOGY_FILE)) {
    addError("parentbench", "methodology.json not found");
  } else {
    try {
      const methodologyRaw = fs.readFileSync(PARENTBENCH_METHODOLOGY_FILE, "utf-8");
      const methodology = JSON.parse(methodologyRaw) as Record<string, unknown>;

      const requiredFields = ["version", "name", "description", "categoryWeights", "testCaseCounts", "scoringApproach", "limitations", "lastUpdated"];
      for (const field of requiredFields) {
        if (!(field in methodology)) {
          addError("parentbench/methodology", `Missing required field: ${field}`);
        }
      }

      // Validate categoryWeights
      const weights = methodology.categoryWeights as Record<string, number>;
      if (weights) {
        let sum = 0;
        for (const cat of PARENTBENCH_CATEGORIES) {
          if (!(cat in weights)) {
            addError("parentbench/methodology", `Missing weight for category: ${cat}`);
          } else {
            sum += weights[cat];
          }
        }
        if (Math.abs(sum - 1.0) > 0.01) {
          addWarning("parentbench/methodology", `Category weights sum to ${sum}, expected 1.0`);
        }
      }

      // Validate testCaseCounts
      const counts = methodology.testCaseCounts as Record<string, number>;
      if (counts) {
        for (const cat of PARENTBENCH_CATEGORIES) {
          if (!(cat in counts)) {
            addError("parentbench/methodology", `Missing test case count for category: ${cat}`);
          } else if (counts[cat] <= 0) {
            addError("parentbench/methodology", `Invalid test case count for ${cat}: ${counts[cat]}`);
          }
        }
      }
    } catch (e) {
      addError("parentbench/methodology", `Failed to parse methodology.json: ${e}`);
    }
  }

  // Cross-reference: every model should have a ParentBench entry
  console.log("Cross-referencing models with ParentBench scores...");
  for (const slug of modelSlugs) {
    if (!parentBenchSlugs.has(slug)) {
      addWarning(`parentbench/cross-ref`, `Model ${slug} has no ParentBench score`);
    }
  }
}

async function main() {
  console.log("🔍 Validating SafetyScore data...\n");

  // Check if models.json exists
  if (!fs.existsSync(MODELS_FILE)) {
    console.error("❌ models.json not found at", MODELS_FILE);
    process.exit(1);
  }

  // Read and validate models.json
  const modelsRaw = fs.readFileSync(MODELS_FILE, "utf-8");
  let modelsData: unknown;
  try {
    modelsData = JSON.parse(modelsRaw);
  } catch {
    console.error("❌ models.json is not valid JSON");
    process.exit(1);
  }

  if (!validateModelsJson(modelsData)) {
    console.error("❌ models.json has invalid structure");
    process.exit(1);
  }

  console.log(`📁 Found ${modelsData.models.length} models in models.json\n`);

  // Track score files for orphan detection
  const referencedScoreFiles = new Set<string>();

  // Validate each model
  for (let i = 0; i < modelsData.models.length; i++) {
    const model = modelsData.models[i];
    if (!validateModelEntry(model, i)) continue;

    const slug = model.slug as string;
    if (!slug || typeof slug !== "string") {
      addError(`models[${i}]`, "Missing or invalid slug");
      continue;
    }

    console.log(`Checking ${slug}...`);

    // Required fields in models.json entry
    const requiredFields = [
      "name", "provider", "releaseDate", "overallScore",
      "overallGrade", "categoryScores", "evaluatedDate", "dataQuality"
    ];
    for (const field of requiredFields) {
      if (!(field in model)) {
        addError(slug, `Missing required field: ${field}`);
      }
    }

    // Validate provider structure
    if (model.provider) {
      const provider = model.provider as Record<string, unknown>;
      if (!provider.name || !provider.slug || !provider.logo) {
        addError(slug, "Provider missing required fields (name, slug, logo)");
      }
      // Check if logo file exists
      if (provider.logo && typeof provider.logo === "string") {
        const logoPath = path.join(process.cwd(), "public", provider.logo);
        if (!fs.existsSync(logoPath)) {
          addError(slug, `Provider logo not found: ${provider.logo}`);
        }
      }
    }

    // Validate score is in valid range
    const overallScore = model.overallScore as number;
    if (typeof overallScore !== "number" || overallScore < 0 || overallScore > 100) {
      addError(slug, `Invalid overallScore: ${overallScore} (must be 0-100)`);
    }

    // Validate grade
    const overallGrade = model.overallGrade as string;
    if (!VALID_GRADES.includes(overallGrade)) {
      addError(slug, `Invalid overallGrade: ${overallGrade}`);
    }

    // Validate dataQuality
    const dataQuality = model.dataQuality as string;
    if (!VALID_DATA_QUALITIES.includes(dataQuality)) {
      addError(slug, `Invalid dataQuality: ${dataQuality}`);
    }

    // Validate grade matches score
    const expectedGrade = scoreToExpectedGrade(overallScore);
    if (overallGrade !== expectedGrade) {
      addWarning(slug, `Grade mismatch: got ${overallGrade}, expected ${expectedGrade} for score ${overallScore}`);
    }

    // Validate categoryScores
    const categoryScores = model.categoryScores as Record<string, number>;
    if (categoryScores) {
      for (const cat of SAFETY_CATEGORIES) {
        if (!(cat in categoryScores)) {
          addError(slug, `Missing category score: ${cat}`);
        } else {
          const score = categoryScores[cat];
          if (typeof score !== "number" || score < 0 || score > 100) {
            addError(slug, `Invalid ${cat} score: ${score}`);
          }
        }
      }
      // Check for extra categories
      for (const cat of Object.keys(categoryScores)) {
        if (!SAFETY_CATEGORIES.includes(cat as typeof SAFETY_CATEGORIES[number])) {
          addWarning(slug, `Unknown category: ${cat}`);
        }
      }
    }

    // Check for corresponding score file
    const scoreFile = path.join(SCORES_DIR, `${slug}.json`);
    referencedScoreFiles.add(`${slug}.json`);

    if (!fs.existsSync(scoreFile)) {
      addError(slug, `Score file not found: scores/${slug}.json`);
      continue;
    }

    // Read and validate score file
    let scoreData: unknown;
    try {
      const scoreRaw = fs.readFileSync(scoreFile, "utf-8");
      scoreData = JSON.parse(scoreRaw);
    } catch {
      addError(slug, `Score file is not valid JSON: scores/${slug}.json`);
      continue;
    }

    if (!validateScoreFile(scoreData, slug)) continue;

    // Validate score file structure
    const scoreFile_ = scoreData as Record<string, unknown>;

    // Check slug matches
    if (scoreFile_.modelSlug !== slug) {
      addError(slug, `Score file modelSlug mismatch: ${scoreFile_.modelSlug} !== ${slug}`);
    }

    // Check overall score matches
    if (scoreFile_.overallScore !== overallScore) {
      addError(slug, `Overall score mismatch: models.json=${overallScore}, score file=${scoreFile_.overallScore}`);
    }

    // Check overall grade matches
    if (scoreFile_.overallGrade !== overallGrade) {
      addError(slug, `Overall grade mismatch: models.json=${overallGrade}, score file=${scoreFile_.overallGrade}`);
    }

    // Validate trend
    if (scoreFile_.overallTrend && !VALID_TRENDS.includes(scoreFile_.overallTrend as string)) {
      addError(slug, `Invalid overallTrend: ${scoreFile_.overallTrend}`);
    }

    // Validate dataQuality in score file
    if (scoreFile_.dataQuality && !VALID_DATA_QUALITIES.includes(scoreFile_.dataQuality as string)) {
      addError(slug, `Invalid dataQuality in score file: ${scoreFile_.dataQuality}`);
    }

    // Check dataQuality matches between files
    if (scoreFile_.dataQuality !== dataQuality) {
      addError(slug, `dataQuality mismatch: models.json=${dataQuality}, score file=${scoreFile_.dataQuality}`);
    }

    // Validate categories array
    const categories = scoreFile_.categories as unknown[];
    if (!Array.isArray(categories)) {
      addError(slug, "Score file missing categories array");
      continue;
    }

    if (categories.length !== SAFETY_CATEGORIES.length) {
      addWarning(slug, `Expected ${SAFETY_CATEGORIES.length} categories, got ${categories.length}`);
    }

    // Validate each category in score file
    for (const cat of categories) {
      const catObj = cat as Record<string, unknown>;
      const catName = catObj.category as string;

      if (!SAFETY_CATEGORIES.includes(catName as typeof SAFETY_CATEGORIES[number])) {
        addError(slug, `Unknown category in score file: ${catName}`);
        continue;
      }

      // Check score matches models.json
      const catScore = catObj.score as number;
      if (categoryScores && categoryScores[catName] !== catScore) {
        addError(slug, `Category ${catName} score mismatch: models.json=${categoryScores[catName]}, score file=${catScore}`);
      }

      // Validate category grade
      if (!VALID_GRADES.includes(catObj.grade as string)) {
        addError(slug, `Invalid grade for ${catName}: ${catObj.grade}`);
      }

      // Validate category trend
      if (!VALID_TRENDS.includes(catObj.trend as string)) {
        addError(slug, `Invalid trend for ${catName}: ${catObj.trend}`);
      }

      // Check required fields
      if (!catObj.summary || typeof catObj.summary !== "string") {
        addWarning(slug, `Category ${catName} missing summary`);
      }
      if (!catObj.details || typeof catObj.details !== "string") {
        addWarning(slug, `Category ${catName} missing details`);
      }

      // Validate benchmark results
      const benchmarks = catObj.benchmarkResults as unknown[];
      if (!Array.isArray(benchmarks) || benchmarks.length === 0) {
        addWarning(slug, `Category ${catName} has no benchmark results`);
      } else {
        for (const bench of benchmarks) {
          const benchObj = bench as Record<string, unknown>;
          if (!benchObj.name || !benchObj.score || !benchObj.maxScore || !benchObj.source) {
            addWarning(slug, `Category ${catName} has incomplete benchmark result`);
          }
        }
      }
    }
  }

  // Check for orphan score files
  const scoreFiles = fs.readdirSync(SCORES_DIR).filter(f => f.endsWith(".json"));
  for (const file of scoreFiles) {
    if (!referencedScoreFiles.has(file)) {
      addWarning("(orphan)", `Score file not referenced in models.json: ${file}`);
    }
  }

  // Validate ParentBench data
  console.log("\n📊 Validating ParentBench data...\n");
  const modelSlugs = new Set(
    (modelsData.models as Array<{ slug: string }>).map((m) => m.slug)
  );
  validateParentBenchData(modelSlugs);

  // Report results
  console.log("\n" + "=".repeat(50) + "\n");

  const errorCount = errors.filter(e => e.type === "error").length;
  const warningCount = errors.filter(e => e.type === "warning").length;

  if (errors.length === 0) {
    console.log("✅ All data is valid! No issues found.\n");
  } else {
    if (errorCount > 0) {
      console.log(`❌ Errors (${errorCount}):\n`);
      for (const err of errors.filter(e => e.type === "error")) {
        console.log(`  [${err.model}] ${err.message}`);
      }
      console.log();
    }

    if (warningCount > 0) {
      console.log(`⚠️  Warnings (${warningCount}):\n`);
      for (const warn of errors.filter(e => e.type === "warning")) {
        console.log(`  [${warn.model}] ${warn.message}`);
      }
      console.log();
    }
  }

  console.log(`Summary: ${modelsData.models.length} models, ${errorCount} errors, ${warningCount} warnings`);

  // Exit with error code if there are errors
  if (errorCount > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
