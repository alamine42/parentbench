import { NextResponse } from "next/server";
import { getAllModelsWithScores } from "@/db/queries/models";

/**
 * GET /api/internal/models
 * Returns all models with their latest scores
 */
export async function GET() {
  try {
    const models = await getAllModelsWithScores();

    return NextResponse.json({
      success: true,
      data: models,
      count: models.length,
    });
  } catch (error) {
    console.error("Error fetching models:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch models",
      },
      { status: 500 }
    );
  }
}
