import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { evaluations, evalResults, testCases, categories, models, providers, scores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateSession } from "../../auth/route";

// Auth helper to reduce duplication
async function requireAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("admin_session");
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return { error: "Admin authentication not configured", status: 500 };
  }

  if (!sessionCookie?.value || !validateSession(sessionCookie.value, adminPassword)) {
    return { error: "Unauthorized", status: 401 };
  }

  return null;
}

/**
 * GET /api/admin/evaluations/[id]
 * Fetch evaluation details with results
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Verify admin authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("admin_session");
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return NextResponse.json(
      { error: "Admin authentication not configured" },
      { status: 500 }
    );
  }

  if (!sessionCookie?.value || !validateSession(sessionCookie.value, adminPassword)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Get evaluation with model and provider info
    const [evaluation] = await db
      .select({
        id: evaluations.id,
        status: evaluations.status,
        triggeredBy: evaluations.triggeredBy,
        inngestRunId: evaluations.inngestRunId,
        startedAt: evaluations.startedAt,
        completedAt: evaluations.completedAt,
        totalTestCases: evaluations.totalTestCases,
        completedTestCases: evaluations.completedTestCases,
        failedTestCases: evaluations.failedTestCases,
        errorMessage: evaluations.errorMessage,
        createdAt: evaluations.createdAt,
        model: {
          id: models.id,
          name: models.name,
          slug: models.slug,
        },
        provider: {
          id: providers.id,
          name: providers.name,
        },
      })
      .from(evaluations)
      .innerJoin(models, eq(evaluations.modelId, models.id))
      .innerJoin(providers, eq(models.providerId, providers.id))
      .where(eq(evaluations.id, id))
      .limit(1);

    if (!evaluation) {
      return NextResponse.json(
        { error: "Evaluation not found" },
        { status: 404 }
      );
    }

    // Get score if available
    const [score] = await db
      .select({
        overallScore: scores.overallScore,
        overallGrade: scores.overallGrade,
        categoryScores: scores.categoryScores,
      })
      .from(scores)
      .where(eq(scores.evaluationId, id))
      .limit(1);

    // Get results with test case info
    const results = await db
      .select({
        id: evalResults.id,
        passed: evalResults.passed,
        score: evalResults.score,
        response: evalResults.response,
        latencyMs: evalResults.latencyMs,
        errorMessage: evalResults.errorMessage,
        metadata: evalResults.metadata,
        testCase: {
          id: testCases.id,
          prompt: testCases.prompt,
          expectedBehavior: testCases.expectedBehavior,
          severity: testCases.severity,
          description: testCases.description,
        },
        category: {
          id: categories.id,
          name: categories.name,
        },
      })
      .from(evalResults)
      .innerJoin(testCases, eq(evalResults.testCaseId, testCases.id))
      .innerJoin(categories, eq(testCases.categoryId, categories.id))
      .where(eq(evalResults.evaluationId, id));

    return NextResponse.json({
      evaluation,
      score: score || null,
      results,
    });
  } catch (error) {
    console.error("Failed to fetch evaluation details:", error);
    return NextResponse.json(
      { error: "Failed to fetch evaluation details" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/evaluations/[id]
 * Delete an evaluation and all associated data (results, scores)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Verify admin authentication
  const authError = await requireAdmin();
  if (authError) {
    return NextResponse.json({ error: authError.error }, { status: authError.status });
  }

  try {
    // Check if evaluation exists
    const [evaluation] = await db
      .select({ id: evaluations.id, status: evaluations.status })
      .from(evaluations)
      .where(eq(evaluations.id, id))
      .limit(1);

    if (!evaluation) {
      return NextResponse.json(
        { error: "Evaluation not found" },
        { status: 404 }
      );
    }

    // Prevent deleting running evaluations
    if (evaluation.status === "running" || evaluation.status === "pending") {
      return NextResponse.json(
        { error: "Cannot delete a running or pending evaluation. Wait for it to complete or fail first." },
        { status: 400 }
      );
    }

    // Delete in order: scores -> eval_results -> evaluations (due to foreign keys)
    // Scores reference evaluationId
    await db.delete(scores).where(eq(scores.evaluationId, id));

    // Eval results reference evaluationId
    await db.delete(evalResults).where(eq(evalResults.evaluationId, id));

    // Finally delete the evaluation itself
    await db.delete(evaluations).where(eq(evaluations.id, id));

    return NextResponse.json({
      success: true,
      message: "Evaluation and all associated data deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete evaluation:", error);
    return NextResponse.json(
      { error: "Failed to delete evaluation" },
      { status: 500 }
    );
  }
}
