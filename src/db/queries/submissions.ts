import { db } from "@/db";
import {
  submissions,
  categories,
  testCases,
  type Submission,
  type Category,
  type TestCase,
} from "@/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";

// ============================================================================
// TYPES
// ============================================================================

export type SubmissionWithCategory = Submission & {
  category: Pick<Category, "id" | "name" | "label">;
};

export type NewSubmissionInput = {
  email: string;
  prompt: string;
  expectedResponse: string;
  categoryId: string;
};

export type ConvertToTestCaseInput = {
  severity: "critical" | "high" | "medium";
  ageBrackets: string[];
  expectedBehavior: "refuse" | "safe_response" | "redirect";
};

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get a single submission by ID with its category
 */
export async function getSubmissionById(
  id: string
): Promise<SubmissionWithCategory | null> {
  const result = await db
    .select({
      id: submissions.id,
      email: submissions.email,
      prompt: submissions.prompt,
      expectedResponse: submissions.expectedResponse,
      categoryId: submissions.categoryId,
      status: submissions.status,
      reviewedBy: submissions.reviewedBy,
      reviewedAt: submissions.reviewedAt,
      reviewNotes: submissions.reviewNotes,
      createdAt: submissions.createdAt,
      category: {
        id: categories.id,
        name: categories.name,
        label: categories.label,
      },
    })
    .from(submissions)
    .innerJoin(categories, eq(submissions.categoryId, categories.id))
    .where(eq(submissions.id, id))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  return result[0] as SubmissionWithCategory;
}

/**
 * Create a new submission
 */
export async function createSubmission(
  data: NewSubmissionInput
): Promise<Submission> {
  const result = await db
    .insert(submissions)
    .values({
      email: data.email,
      prompt: data.prompt,
      expectedResponse: data.expectedResponse,
      categoryId: data.categoryId,
      status: "pending",
    })
    .returning();

  return result[0];
}

/**
 * Update submission status (approve or reject)
 * Uses atomic conditional update to prevent race conditions
 * Only updates if submission is still pending
 * Returns null if no rows were updated (already processed)
 */
export async function updateSubmissionStatus(
  id: string,
  status: "approved" | "rejected",
  reviewerId: string,
  reviewNotes?: string
): Promise<Submission | null> {
  // Atomic update: only update if status is still 'pending'
  // This prevents race conditions where two reviewers process the same submission
  const result = await db
    .update(submissions)
    .set({
      status,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      reviewNotes: reviewNotes || null,
    })
    .where(and(eq(submissions.id, id), eq(submissions.status, "pending")))
    .returning();

  // If no rows updated, the submission was already processed
  if (result.length === 0) {
    return null;
  }

  return result[0];
}

/**
 * Convert an approved submission to a test case
 */
export async function convertSubmissionToTestCase(
  submission: Submission,
  additionalData: ConvertToTestCaseInput
): Promise<TestCase> {
  const result = await db
    .insert(testCases)
    .values({
      categoryId: submission.categoryId,
      prompt: submission.prompt,
      expectedBehavior: additionalData.expectedBehavior,
      severity: additionalData.severity,
      description: `Community submission: ${submission.expectedResponse}`,
      ageBrackets: additionalData.ageBrackets,
      modality: "text",
      isActive: true,
    })
    .returning();

  return result[0];
}

/**
 * Check for duplicate submission (same prompt from same email within 24h)
 */
export async function checkDuplicateSubmission(
  prompt: string,
  email: string
): Promise<boolean> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Normalize prompt for comparison (lowercase, trim whitespace)
  const normalizedPrompt = prompt.toLowerCase().trim();

  const result = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(
      and(
        eq(submissions.email, email.toLowerCase()),
        gte(submissions.createdAt, twentyFourHoursAgo),
        sql`LOWER(TRIM(${submissions.prompt})) = ${normalizedPrompt}`
      )
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Get all categories for the submission form
 */
export async function getAllCategories(): Promise<
  Pick<Category, "id" | "name" | "label" | "description">[]
> {
  const result = await db
    .select({
      id: categories.id,
      name: categories.name,
      label: categories.label,
      description: categories.description,
    })
    .from(categories)
    .orderBy(categories.label);

  return result;
}

/**
 * Get pending submissions count for dashboard
 */
export async function getPendingSubmissionsCount(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(submissions)
    .where(eq(submissions.status, "pending"));

  return result[0]?.count ?? 0;
}

/**
 * Get recent submissions by email (for rate limiting check)
 */
export async function getRecentSubmissionsByEmail(
  email: string,
  withinHours: number = 1
): Promise<number> {
  const cutoffTime = new Date(Date.now() - withinHours * 60 * 60 * 1000);

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(submissions)
    .where(
      and(
        eq(submissions.email, email.toLowerCase()),
        gte(submissions.createdAt, cutoffTime)
      )
    );

  return result[0]?.count ?? 0;
}

/**
 * Get submission by ID (simple version for status check)
 */
export async function getSubmissionStatusById(
  id: string
): Promise<{ id: string; status: string } | null> {
  const result = await db
    .select({
      id: submissions.id,
      status: submissions.status,
    })
    .from(submissions)
    .where(eq(submissions.id, id))
    .limit(1);

  return result[0] || null;
}
