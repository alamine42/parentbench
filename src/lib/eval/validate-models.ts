/**
 * Model Validation Utility
 *
 * Validates that all configured model names are valid and accessible.
 * Run this:
 * - At build/deploy time (CI)
 * - Before running evaluations
 * - As a scheduled health check
 *
 * Usage:
 *   npx tsx src/lib/eval/validate-models.ts
 */

interface ModelConfig {
  provider: "anthropic" | "openai" | "google" | "together";
  modelId: string;
  purpose: string;
}

// All models used in the codebase
const ALL_MODELS: ModelConfig[] = [
  // Judge model
  { provider: "anthropic", modelId: "claude-haiku-4-5-20251001", purpose: "LLM Judge" },

  // Anthropic evaluation models
  { provider: "anthropic", modelId: "claude-opus-4-7", purpose: "Evaluation" },
  { provider: "anthropic", modelId: "claude-opus-4-6", purpose: "Evaluation" },
  { provider: "anthropic", modelId: "claude-sonnet-4-6", purpose: "Evaluation" },
  { provider: "anthropic", modelId: "claude-haiku-4-5", purpose: "Evaluation" },
  { provider: "anthropic", modelId: "claude-sonnet-4-5", purpose: "Evaluation" },
  { provider: "anthropic", modelId: "claude-opus-4-5", purpose: "Evaluation" },
  { provider: "anthropic", modelId: "claude-opus-4-1", purpose: "Evaluation" },
  { provider: "anthropic", modelId: "claude-sonnet-4-0", purpose: "Evaluation" },
  { provider: "anthropic", modelId: "claude-opus-4-0", purpose: "Evaluation" },

  // OpenAI evaluation models
  { provider: "openai", modelId: "gpt-4o", purpose: "Evaluation" },
  { provider: "openai", modelId: "gpt-4o-mini", purpose: "Evaluation" },
  { provider: "openai", modelId: "gpt-4.1", purpose: "Evaluation" },
  { provider: "openai", modelId: "gpt-4.1-mini", purpose: "Evaluation" },

  // Google evaluation models
  { provider: "google", modelId: "gemini-3.1-pro-preview", purpose: "Evaluation" },
  { provider: "google", modelId: "gemini-3-flash-preview", purpose: "Evaluation" },
  { provider: "google", modelId: "gemini-2.5-pro", purpose: "Evaluation" },
  { provider: "google", modelId: "gemini-2.5-flash", purpose: "Evaluation" },
  { provider: "google", modelId: "gemini-2.5-flash-lite", purpose: "Evaluation" },
];

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

async function validateAnthropicModel(modelId: string): Promise<{ valid: boolean; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { valid: false, error: "ANTHROPIC_API_KEY not set" };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    if (response.ok) {
      return { valid: true };
    }

    const error = await response.json();
    if (error.error?.type === "not_found_error") {
      return { valid: false, error: `Model not found: ${modelId}` };
    }
    // Other errors (rate limit, etc.) mean the model exists
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function validateOpenAIModel(modelId: string): Promise<{ valid: boolean; error?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { valid: false, error: "OPENAI_API_KEY not set" };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      }),
    });

    if (response.ok) {
      return { valid: true };
    }

    const error = await response.json();
    if (error.error?.code === "model_not_found") {
      return { valid: false, error: `Model not found: ${modelId}` };
    }
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function validateGoogleModel(modelId: string): Promise<{ valid: boolean; error?: string }> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return { valid: false, error: "GOOGLE_AI_API_KEY not set" };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "hi" }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
      }
    );

    if (response.ok) {
      return { valid: true };
    }

    const error = await response.json();
    if (error.error?.status === "NOT_FOUND") {
      return { valid: false, error: `Model not found: ${modelId}` };
    }
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function validateModel(config: ModelConfig): Promise<{ valid: boolean; error?: string }> {
  switch (config.provider) {
    case "anthropic":
      return validateAnthropicModel(config.modelId);
    case "openai":
      return validateOpenAIModel(config.modelId);
    case "google":
      return validateGoogleModel(config.modelId);
    default:
      return { valid: false, error: `Unknown provider: ${config.provider}` };
  }
}

// ============================================================================
// MAIN VALIDATION RUNNER
// ============================================================================

export async function validateAllModels(options?: {
  filter?: "anthropic" | "openai" | "google";
  purpose?: string;
}): Promise<{
  valid: ModelConfig[];
  invalid: Array<ModelConfig & { error: string }>;
  skipped: Array<ModelConfig & { reason: string }>;
}> {
  const valid: ModelConfig[] = [];
  const invalid: Array<ModelConfig & { error: string }> = [];
  const skipped: Array<ModelConfig & { reason: string }> = [];

  let models = ALL_MODELS;

  if (options?.filter) {
    models = models.filter(m => m.provider === options.filter);
  }
  if (options?.purpose) {
    models = models.filter(m => m.purpose === options.purpose);
  }

  for (const config of models) {
    const result = await validateModel(config);

    if (result.error?.includes("not set")) {
      skipped.push({ ...config, reason: result.error });
    } else if (result.valid) {
      valid.push(config);
    } else {
      invalid.push({ ...config, error: result.error || "Unknown error" });
    }
  }

  return { valid, invalid, skipped };
}

// ============================================================================
// CLI RUNNER
// ============================================================================

async function main() {
  console.log("🔍 Validating all configured models...\n");

  const { valid, invalid, skipped } = await validateAllModels();

  if (valid.length > 0) {
    console.log(`✅ Valid models (${valid.length}):`);
    valid.forEach(m => console.log(`   ${m.provider}/${m.modelId} (${m.purpose})`));
  }

  if (skipped.length > 0) {
    console.log(`\n⏭️  Skipped (${skipped.length}):`);
    skipped.forEach(m => console.log(`   ${m.provider}/${m.modelId} - ${m.reason}`));
  }

  if (invalid.length > 0) {
    console.log(`\n❌ Invalid models (${invalid.length}):`);
    invalid.forEach(m => console.log(`   ${m.provider}/${m.modelId} - ${m.error}`));
    process.exit(1);
  }

  console.log("\n✨ All models validated successfully!");
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}
