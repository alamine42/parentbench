import { NextResponse } from "next/server";
import { getModelBySlug, getModelScoreHistory } from "@/db/queries/models";

type Params = {
  params: Promise<{ slug: string }>;
};

/**
 * GET /api/internal/models/[slug]/scores
 * Returns score history for a model
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const { slug } = await params;

    // Get model first to verify it exists
    const model = await getModelBySlug(slug);

    if (!model) {
      return NextResponse.json(
        {
          success: false,
          error: "Model not found",
        },
        { status: 404 }
      );
    }

    // Get URL params for limit
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "30", 10);

    const history = await getModelScoreHistory(model.id, limit);

    return NextResponse.json({
      success: true,
      data: {
        modelSlug: slug,
        modelName: model.name,
        history,
      },
    });
  } catch (error) {
    console.error("Error fetching score history:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch score history",
      },
      { status: 500 }
    );
  }
}
