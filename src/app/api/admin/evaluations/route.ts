import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { models, evaluations, providers } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import { validateSession } from "../auth/route";

/**
 * GET /api/admin/evaluations
 * Fetch all evaluations with model info
 */
export async function GET() {
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
    const allEvaluations = await db
      .select({
        id: evaluations.id,
        status: evaluations.status,
        triggeredBy: evaluations.triggeredBy,
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
      .orderBy(desc(evaluations.createdAt))
      .limit(100);

    // Check if any are running (for polling hint)
    const hasRunning = allEvaluations.some(e => e.status === "running" || e.status === "pending");

    return NextResponse.json({
      evaluations: allEvaluations,
      hasRunning,
    });
  } catch (error) {
    console.error("Failed to fetch evaluations:", error);
    return NextResponse.json(
      { error: "Failed to fetch evaluations" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/evaluations
 * Trigger a new evaluation for a model
 */
export async function POST(request: NextRequest) {
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
    const { modelId } = await request.json();

    if (!modelId) {
      return NextResponse.json(
        { error: "modelId is required" },
        { status: 400 }
      );
    }

    // Get the model to verify it exists
    const [model] = await db
      .select()
      .from(models)
      .where(eq(models.id, modelId))
      .limit(1);

    if (!model) {
      return NextResponse.json(
        { error: "Model not found" },
        { status: 404 }
      );
    }

    // Trigger the evaluation via Inngest
    const result = await inngest.send({
      name: "eval/requested",
      data: {
        modelId: model.id,
        modelSlug: model.slug,
        triggeredBy: "manual",
      },
    });

    return NextResponse.json({
      success: true,
      message: `Evaluation triggered for ${model.name}`,
      eventIds: result.ids,
    });
  } catch (error) {
    console.error("Failed to trigger evaluation:", error);
    return NextResponse.json(
      { error: "Failed to trigger evaluation" },
      { status: 500 }
    );
  }
}
