import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { models } from "@/db/schema";
import { eq } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import { validateSession } from "../auth/route";

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
