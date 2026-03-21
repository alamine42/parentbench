import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getModelWithScore } from "@/db/queries/models";
import { ReportCardDocument, type ReportCardData } from "@/lib/pdf/report-generator";
import crypto from "crypto";

type Params = {
  params: Promise<{ modelSlug: string }>;
};

// Secret salt for report ID generation - prevents enumeration attacks
const REPORT_ID_SALT = process.env.REPORT_ID_SALT || "parentbench-default-salt-change-in-prod";

/**
 * Generate a salted report ID based on model, date, and secret
 * Uses HMAC to prevent enumeration attacks
 */
function generateReportId(modelSlug: string, date: Date, modelId: string): string {
  const dateStr = date.toISOString().split("T")[0];
  const hmac = crypto
    .createHmac("sha256", REPORT_ID_SALT)
    .update(`${modelId}-${modelSlug}-${dateStr}`)
    .digest("hex")
    .slice(0, 16);
  return hmac;
}

/**
 * GET /api/internal/reports/[modelSlug]
 *
 * Generate a PDF report card for a model.
 *
 * Query params:
 * - format: "pdf" (default) or "json" (returns report data)
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const { modelSlug } = await params;
    const url = new URL(request.url);
    const format = url.searchParams.get("format") || "pdf";

    // Fetch model with score
    const model = await getModelWithScore(modelSlug);

    if (!model) {
      return NextResponse.json(
        {
          success: false,
          error: "Model not found",
        },
        { status: 404 }
      );
    }

    if (!model.latestScore) {
      return NextResponse.json(
        {
          success: false,
          error: "Model has no scores yet",
        },
        { status: 404 }
      );
    }

    // Generate report ID (salted HMAC for security)
    const reportId = generateReportId(modelSlug, model.latestScore.computedAt, model.id);

    // Build base URL for verification
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://parentbench.org";
    const verifyUrl = `${baseUrl}/verify/${reportId}`;

    // Prepare report data
    const reportData: ReportCardData = {
      modelName: model.name,
      modelSlug: model.slug,
      providerName: model.provider.name,
      overallScore: model.latestScore.overallScore,
      overallGrade: model.latestScore.overallGrade,
      categoryScores: model.latestScore.categoryScores,
      evaluatedDate: model.latestScore.computedAt.toISOString(),
      reportId,
      verifyUrl,
    };

    // Return JSON if requested
    if (format === "json") {
      return NextResponse.json({
        success: true,
        data: reportData,
      });
    }

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      ReportCardDocument({ data: reportData })
    );

    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(pdfBuffer);

    // Return PDF
    return new NextResponse(uint8Array, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="parentbench-${modelSlug}-report.pdf"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate report",
      },
      { status: 500 }
    );
  }
}
