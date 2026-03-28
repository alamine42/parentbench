import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  real,
  pgEnum,
  uuid,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// ENUMS
// ============================================================================

export const dataQualityEnum = pgEnum("data_quality", [
  "verified",
  "partial",
  "estimated",
]);

export const trendDirectionEnum = pgEnum("trend_direction", [
  "up",
  "down",
  "stable",
  "new",
]);

export const letterGradeEnum = pgEnum("letter_grade", [
  "A+", "A", "A-",
  "B+", "B", "B-",
  "C+", "C", "C-",
  "D+", "D", "D-",
  "F",
]);

export const categoryEnum = pgEnum("category", [
  "age_inappropriate_content",
  "manipulation_resistance",
  "data_privacy_minors",
  "parental_controls_respect",
]);

export const modalityEnum = pgEnum("modality", [
  "text",
  "image",
  "audio",
  "multimodal",
]);

export const evaluationStatusEnum = pgEnum("evaluation_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "partial",
]);

export const certificationStatusEnum = pgEnum("certification_status", [
  "none",
  "applied",
  "in_review",
  "approved",
  "rejected",
  "revoked",
  "appealing",
]);

export const userRoleEnum = pgEnum("user_role", [
  "parent",
  "provider",
  "admin",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "pending",
  "approved",
  "rejected",
]);

export const expectedBehaviorEnum = pgEnum("expected_behavior", [
  "refuse",
  "safe_response",
  "redirect",
]);

export const severityEnum = pgEnum("severity", [
  "critical",
  "high",
  "medium",
]);

export const evalTierEnum = pgEnum("eval_tier", [
  "active",      // Weekly evaluations (3 runs) - flagship models
  "standard",    // Bi-weekly evaluations (3 runs) - mid-tier models
  "maintenance", // Monthly evaluations (3 runs) - legacy/stable models
  "paused",      // Manual only (1 run) - deprecated/testing
]);

// ============================================================================
// PROVIDERS & MODELS
// ============================================================================

export const providers = pgTable("providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  website: text("website"),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const providersRelations = relations(providers, ({ many }) => ({
  models: many(models),
  certifications: many(certifications),
}));

export const models = pgTable("models", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id")
    .notNull()
    .references(() => providers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  releaseDate: timestamp("release_date"),
  parameterCount: text("parameter_count"),
  capabilities: jsonb("capabilities").$type<string[]>().default([]),
  isActive: boolean("is_active").default(true).notNull(),
  evalTier: evalTierEnum("eval_tier").default("standard").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const modelsRelations = relations(models, ({ one, many }) => ({
  provider: one(providers, {
    fields: [models.providerId],
    references: [providers.id],
  }),
  evaluations: many(evaluations),
  scores: many(scores),
  certifications: many(certifications),
  alerts: many(alerts),
}));

// ============================================================================
// CATEGORIES & TEST CASES
// ============================================================================

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: categoryEnum("name").notNull().unique(),
  label: text("label").notNull(),
  description: text("description").notNull(),
  question: text("question").notNull(),
  icon: text("icon"),
  weight: real("weight").notNull().default(0.25),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const categoriesRelations = relations(categories, ({ many }) => ({
  testCases: many(testCases),
}));

export const testCases = pgTable("test_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  expectedBehavior: expectedBehaviorEnum("expected_behavior").notNull(),
  severity: severityEnum("severity").notNull(),
  description: text("description").notNull(),
  ageBrackets: jsonb("age_brackets").$type<string[]>().default(["6-9", "10-12", "13-15"]),
  modality: modalityEnum("modality").default("text").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const testCasesRelations = relations(testCases, ({ one, many }) => ({
  category: one(categories, {
    fields: [testCases.categoryId],
    references: [categories.id],
  }),
  evalResults: many(evalResults),
}));

// ============================================================================
// EVALUATIONS & RESULTS
// ============================================================================

export const evaluations = pgTable("evaluations", {
  id: uuid("id").primaryKey().defaultRandom(),
  modelId: uuid("model_id")
    .notNull()
    .references(() => models.id, { onDelete: "cascade" }),
  status: evaluationStatusEnum("status").default("pending").notNull(),
  triggeredBy: text("triggered_by"), // 'manual', 'scheduled', 'webhook'
  inngestRunId: text("inngest_run_id"), // Inngest function run ID for debugging
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  totalTestCases: integer("total_test_cases").default(0).notNull(),
  completedTestCases: integer("completed_test_cases").default(0).notNull(),
  failedTestCases: integer("failed_test_cases").default(0).notNull(),
  errorMessage: text("error_message"),
  // Cost tracking fields
  inputTokens: integer("input_tokens").default(0).notNull(),
  outputTokens: integer("output_tokens").default(0).notNull(),
  totalCostUsd: real("total_cost_usd").default(0).notNull(),
  costEstimated: boolean("cost_estimated").default(false).notNull(), // true if backfilled/estimated
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const evaluationsRelations = relations(evaluations, ({ one, many }) => ({
  model: one(models, {
    fields: [evaluations.modelId],
    references: [models.id],
  }),
  results: many(evalResults),
}));

export const evalResults = pgTable("eval_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  evaluationId: uuid("evaluation_id")
    .notNull()
    .references(() => evaluations.id, { onDelete: "cascade" }),
  testCaseId: uuid("test_case_id")
    .notNull()
    .references(() => testCases.id, { onDelete: "cascade" }),
  response: text("response"),
  score: real("score"), // 0-100
  passed: boolean("passed"),
  latencyMs: integer("latency_ms"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const evalResultsRelations = relations(evalResults, ({ one }) => ({
  evaluation: one(evaluations, {
    fields: [evalResults.evaluationId],
    references: [evaluations.id],
  }),
  testCase: one(testCases, {
    fields: [evalResults.testCaseId],
    references: [testCases.id],
  }),
}));

// ============================================================================
// SCORES (Historical)
// ============================================================================

export const scores = pgTable("scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  modelId: uuid("model_id")
    .notNull()
    .references(() => models.id, { onDelete: "cascade" }),
  overallScore: real("overall_score").notNull(),
  overallGrade: letterGradeEnum("overall_grade").notNull(),
  trend: trendDirectionEnum("trend").default("new").notNull(),
  dataQuality: dataQualityEnum("data_quality").default("estimated").notNull(),
  categoryScores: jsonb("category_scores").$type<{
    category: string;
    score: number;
    grade: string;
    passRate: number;
    testCount: number;
  }[]>().notNull(),
  evaluationId: uuid("evaluation_id").references(() => evaluations.id),
  computedAt: timestamp("computed_at").defaultNow().notNull(),
});

export const scoresRelations = relations(scores, ({ one }) => ({
  model: one(models, {
    fields: [scores.modelId],
    references: [models.id],
  }),
  evaluation: one(evaluations, {
    fields: [scores.evaluationId],
    references: [evaluations.id],
  }),
}));

// ============================================================================
// CERTIFICATIONS
// ============================================================================

export const certifications = pgTable("certifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id")
    .notNull()
    .references(() => providers.id, { onDelete: "cascade" }),
  modelId: uuid("model_id")
    .notNull()
    .references(() => models.id, { onDelete: "cascade" }),
  status: certificationStatusEnum("status").default("none").notNull(),
  appliedAt: timestamp("applied_at"),
  reviewedAt: timestamp("reviewed_at"),
  reviewerId: uuid("reviewer_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  revokedAt: timestamp("revoked_at"),
  revokeReason: text("revoke_reason"),
  paymentId: text("payment_id"), // Stripe payment ID
  paymentAmount: integer("payment_amount"), // in cents
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const certificationsRelations = relations(certifications, ({ one }) => ({
  provider: one(providers, {
    fields: [certifications.providerId],
    references: [providers.id],
  }),
  model: one(models, {
    fields: [certifications.modelId],
    references: [models.id],
  }),
  reviewer: one(users, {
    fields: [certifications.reviewerId],
    references: [users.id],
  }),
}));

// ============================================================================
// USERS & AUTH
// ============================================================================

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  role: userRoleEnum("role").default("parent").notNull(),
  providerId: uuid("provider_id").references(() => providers.id),
  emailVerified: boolean("email_verified").default(false).notNull(),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  provider: one(providers, {
    fields: [users.providerId],
    references: [providers.id],
  }),
  apiKeys: many(apiKeys),
  reviewedCertifications: many(certifications),
}));

// ============================================================================
// API KEYS
// ============================================================================

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  keyHash: text("key_hash").notNull(), // bcrypt hash of the API key
  keyPrefix: text("key_prefix").notNull(), // First 8 chars for identification
  name: text("name").notNull(),
  rateLimit: integer("rate_limit").default(1000).notNull(), // requests per hour
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// ALERTS (Email Subscriptions)
// ============================================================================

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  modelId: uuid("model_id")
    .notNull()
    .references(() => models.id, { onDelete: "cascade" }),
  unsubscribeToken: text("unsubscribe_token").notNull().unique(),
  isActive: boolean("is_active").default(true).notNull(),
  lastNotifiedAt: timestamp("last_notified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const alertsRelations = relations(alerts, ({ one }) => ({
  model: one(models, {
    fields: [alerts.modelId],
    references: [models.id],
  }),
}));

// ============================================================================
// COMMUNITY SUBMISSIONS
// ============================================================================

export const submissions = pgTable("submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  prompt: text("prompt").notNull(),
  expectedResponse: text("expected_response").notNull(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id),
  status: submissionStatusEnum("status").default("pending").notNull(),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const submissionsRelations = relations(submissions, ({ one }) => ({
  category: one(categories, {
    fields: [submissions.categoryId],
    references: [categories.id],
  }),
  reviewer: one(users, {
    fields: [submissions.reviewedBy],
    references: [users.id],
  }),
}));

// ============================================================================
// COST TRACKING & BUDGET
// ============================================================================

export const providerPricing = pgTable("provider_pricing", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id")
    .notNull()
    .references(() => providers.id, { onDelete: "cascade" }),
  modelPattern: text("model_pattern").notNull(), // e.g., "gpt-4o", "claude-*", regex pattern
  inputPricePerMillion: real("input_price_per_million").notNull(), // USD per 1M input tokens
  outputPricePerMillion: real("output_price_per_million").notNull(), // USD per 1M output tokens
  effectiveDate: timestamp("effective_date").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const providerPricingRelations = relations(providerPricing, ({ one }) => ({
  provider: one(providers, {
    fields: [providerPricing.providerId],
    references: [providers.id],
  }),
}));

export const budgetAlerts = pgTable("budget_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  thresholdUsd: real("threshold_usd").notNull(), // Alert when cumulative spend reaches this
  periodDays: integer("period_days").notNull(), // Rolling period (e.g., 30 for monthly)
  isActive: boolean("is_active").default(true).notNull(),
  lastTriggeredAt: timestamp("last_triggered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const budgetAlertHistory = pgTable("budget_alert_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  alertId: uuid("alert_id")
    .notNull()
    .references(() => budgetAlerts.id, { onDelete: "cascade" }),
  triggeredAt: timestamp("triggered_at").defaultNow().notNull(),
  currentSpend: real("current_spend").notNull(),
  thresholdUsd: real("threshold_usd").notNull(),
  message: text("message"),
});

export const budgetAlertHistoryRelations = relations(budgetAlertHistory, ({ one }) => ({
  alert: one(budgetAlerts, {
    fields: [budgetAlertHistory.alertId],
    references: [budgetAlerts.id],
  }),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Provider = typeof providers.$inferSelect;
export type NewProvider = typeof providers.$inferInsert;

export type Model = typeof models.$inferSelect;
export type NewModel = typeof models.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type TestCase = typeof testCases.$inferSelect;
export type NewTestCase = typeof testCases.$inferInsert;

export type Evaluation = typeof evaluations.$inferSelect;
export type NewEvaluation = typeof evaluations.$inferInsert;

export type EvalResult = typeof evalResults.$inferSelect;
export type NewEvalResult = typeof evalResults.$inferInsert;

export type Score = typeof scores.$inferSelect;
export type NewScore = typeof scores.$inferInsert;

export type Certification = typeof certifications.$inferSelect;
export type NewCertification = typeof certifications.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;

export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;

export type ProviderPricing = typeof providerPricing.$inferSelect;
export type NewProviderPricing = typeof providerPricing.$inferInsert;

export type BudgetAlert = typeof budgetAlerts.$inferSelect;
export type NewBudgetAlert = typeof budgetAlerts.$inferInsert;

export type BudgetAlertHistoryEntry = typeof budgetAlertHistory.$inferSelect;
export type NewBudgetAlertHistoryEntry = typeof budgetAlertHistory.$inferInsert;
