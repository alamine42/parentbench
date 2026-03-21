import { NextRequest, NextResponse } from "next/server";
import {
  getSubmissionById,
  updateSubmissionStatus,
  convertSubmissionToTestCase,
} from "@/db/queries/submissions";
import { inngest } from "@/inngest/client";

// ============================================================================
// AUTH CHECK
// ============================================================================

/**
 * Check if request is from an authorized admin
 * Mirrors the logic from admin layout for API routes
 */
async function checkAdminAuth(): Promise<boolean> {
  // In development or with bypass flag, allow access
  const isDev = process.env.NODE_ENV === "development";
  const adminBypass = process.env.ADMIN_BYPASS === "true";

  if (isDev || adminBypass) {
    return true;
  }

  // In production, would verify session/JWT from request headers
  // For now, deny access in production without bypass
  return false;
}

// ============================================================================
// TYPES
// ============================================================================

interface ReviewRequest {
  action: "approve" | "reject";
  reviewNotes?: string;
  // For approval only:
  severity?: "critical" | "high" | "medium";
  ageBrackets?: string[];
  expectedBehavior?: "refuse" | "safe_response" | "redirect";
}

// ============================================================================
// GET - Retrieve submission details
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check admin authentication
  const isAuthed = await checkAdminAuth();
  if (!isAuthed) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const submission = await getSubmissionById(id);

    if (!submission) {
      return NextResponse.json(
        { success: false, error: "Submission not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: submission,
    });
  } catch (error) {
    console.error("Error fetching submission:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch submission" },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Approve or reject submission
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check admin authentication
  const isAuthed = await checkAdminAuth();
  if (!isAuthed) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as ReviewRequest;

    // Validate action
    if (!body.action || !["approve", "reject"].includes(body.action)) {
      return NextResponse.json(
        { success: false, error: "Invalid action. Must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    // Get full submission for email and conversion
    const submission = await getSubmissionById(id);
    if (!submission) {
      return NextResponse.json(
        { success: false, error: "Submission not found" },
        { status: 404 }
      );
    }

    // For approval, validate required fields upfront
    if (body.action === "approve") {
      if (!body.severity || !["critical", "high", "medium"].includes(body.severity)) {
        return NextResponse.json(
          { success: false, error: "Severity is required for approval" },
          { status: 400 }
        );
      }

      if (!body.ageBrackets || !Array.isArray(body.ageBrackets) || body.ageBrackets.length === 0) {
        return NextResponse.json(
          { success: false, error: "At least one age bracket is required for approval" },
          { status: 400 }
        );
      }

      if (!body.expectedBehavior || !["refuse", "safe_response", "redirect"].includes(body.expectedBehavior)) {
        return NextResponse.json(
          { success: false, error: "Expected behavior is required for approval" },
          { status: 400 }
        );
      }
    }

    // TODO: Get actual reviewer ID from auth session
    // For now, use a placeholder (in production, this would come from the session)
    const reviewerId = "00000000-0000-0000-0000-000000000000";

    let testCase = null;

    // If approving, create test case FIRST (before updating status)
    // This ensures we don't mark as approved if test case creation fails
    if (body.action === "approve") {
      testCase = await convertSubmissionToTestCase(submission, {
        severity: body.severity!,
        ageBrackets: body.ageBrackets!,
        expectedBehavior: body.expectedBehavior!,
      });
    }

    // Update submission status with atomic conditional update
    // This returns null if the submission was already processed (race condition prevention)
    const updatedSubmission = await updateSubmissionStatus(
      id,
      body.action === "approve" ? "approved" : "rejected",
      reviewerId,
      body.reviewNotes
    );

    // If no submission was updated, it was already processed by another reviewer
    if (!updatedSubmission) {
      return NextResponse.json(
        { success: false, error: "Submission has already been reviewed" },
        { status: 409 }
      );
    }

    // Send event for email notification (non-blocking, Inngest handles retries)
    await inngest.send({
      name: "submission/status-changed",
      data: {
        submissionId: id,
        email: submission.email,
        prompt: submission.prompt,
        status: body.action === "approve" ? "approved" : "rejected",
        reviewNotes: body.reviewNotes,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        submission: updatedSubmission,
        testCase: testCase,
      },
    });
  } catch (error) {
    console.error("Error reviewing submission:", error);
    return NextResponse.json(
      { success: false, error: "Failed to review submission" },
      { status: 500 }
    );
  }
}
