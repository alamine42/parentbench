import { NextResponse } from "next/server";
import { getModelWithScore } from "@/db/queries/models";

type Params = {
  params: Promise<{ slug: string }>;
};

/**
 * GET /api/internal/models/[slug]
 * Returns a single model by slug with its latest score
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const model = await getModelWithScore(slug);

    if (!model) {
      return NextResponse.json(
        {
          success: false,
          error: "Model not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: model,
    });
  } catch (error) {
    console.error("Error fetching model:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch model",
      },
      { status: 500 }
    );
  }
}
