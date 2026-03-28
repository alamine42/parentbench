import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  createSubmission,
  checkDuplicateSubmission,
  getRecentSubmissionsByEmail,
} from "@/db/queries/submissions";

// ============================================================================
// RATE LIMITING (in-memory for simplicity)
// ============================================================================

// Map: email -> array of timestamps
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_SUBMISSIONS_PER_HOUR = 5;

function checkRateLimit(email: string): boolean {
  // Run lazy cleanup if needed
  cleanupStaleEntries();

  const now = Date.now();
  const normalizedEmail = email.toLowerCase().trim();
  const timestamps = rateLimitMap.get(normalizedEmail) || [];

  // Filter out timestamps older than the window
  const recentTimestamps = timestamps.filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );

  if (recentTimestamps.length >= MAX_SUBMISSIONS_PER_HOUR) {
    return false; // Rate limited
  }

  // Add current timestamp and update map
  recentTimestamps.push(now);
  rateLimitMap.set(normalizedEmail, recentTimestamps);

  return true; // Not rate limited
}

// Track last cleanup time for lazy cleanup
let lastCleanupTime = Date.now();
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

// Lazy cleanup: clean stale entries when checking rate limits
// This avoids interval-based cleanup which doesn't work well in serverless
function cleanupStaleEntries(): void {
  const now = Date.now();
  if (now - lastCleanupTime < CLEANUP_INTERVAL_MS) {
    return; // Not time to clean up yet
  }

  lastCleanupTime = now;
  for (const [email, timestamps] of rateLimitMap.entries()) {
    const recentTimestamps = timestamps.filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS
    );
    if (recentTimestamps.length === 0) {
      rateLimitMap.delete(email);
    } else {
      rateLimitMap.set(email, recentTimestamps);
    }
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

interface SubmissionRequest {
  email: string;
  prompt: string;
  expectedResponse: string;
  categoryId: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function sanitizeInput(input: string): string {
  // Remove HTML tags and trim whitespace
  return input.replace(/<[^>]*>/g, "").trim();
}

function validateSubmission(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Invalid request body"] };
  }

  const body = data as Record<string, unknown>;

  // Email validation
  if (!body.email || typeof body.email !== "string") {
    errors.push("Email is required");
  } else if (!validateEmail(body.email)) {
    errors.push("Invalid email format");
  }

  // Prompt validation
  if (!body.prompt || typeof body.prompt !== "string") {
    errors.push("Prompt is required");
  } else {
    const promptLength = sanitizeInput(body.prompt).length;
    if (promptLength < 20) {
      errors.push("Prompt must be at least 20 characters");
    } else if (promptLength > 2000) {
      errors.push("Prompt must be at most 2000 characters");
    }
  }

  // Expected response validation
  if (!body.expectedResponse || typeof body.expectedResponse !== "string") {
    errors.push("Expected response is required");
  } else {
    const responseLength = sanitizeInput(body.expectedResponse).length;
    if (responseLength < 20) {
      errors.push("Expected response must be at least 20 characters");
    } else if (responseLength > 1000) {
      errors.push("Expected response must be at most 1000 characters");
    }
  }

  // Category ID validation
  if (!body.categoryId || typeof body.categoryId !== "string") {
    errors.push("Category is required");
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. Validate input
    const validation = validateSubmission(body);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 }
      );
    }

    const data = body as SubmissionRequest;
    const email = data.email.toLowerCase().trim();
    const prompt = sanitizeInput(data.prompt);
    const expectedResponse = sanitizeInput(data.expectedResponse);
    const categoryId = data.categoryId;

    // 2. Check rate limit (in-memory)
    if (!checkRateLimit(email)) {
      return NextResponse.json(
        {
          success: false,
          errors: ["Too many submissions. Please try again later."],
        },
        { status: 429 }
      );
    }

    // 3. Verify category exists
    const categoryResult = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    if (categoryResult.length === 0) {
      return NextResponse.json(
        { success: false, errors: ["Invalid category"] },
        { status: 400 }
      );
    }

    // 4. Check for duplicate submission (same prompt from same email in 24h)
    const isDuplicate = await checkDuplicateSubmission(prompt, email);
    if (isDuplicate) {
      return NextResponse.json(
        {
          success: false,
          errors: [
            "You have already submitted a similar test case. Please wait 24 hours before resubmitting.",
          ],
        },
        { status: 409 }
      );
    }

    // 5. Also check database rate limit as backup
    const recentCount = await getRecentSubmissionsByEmail(email, 1);
    if (recentCount >= MAX_SUBMISSIONS_PER_HOUR) {
      return NextResponse.json(
        {
          success: false,
          errors: ["Too many submissions. Please try again later."],
        },
        { status: 429 }
      );
    }

    // 6. Create submission
    const submission = await createSubmission({
      email,
      prompt,
      expectedResponse,
      categoryId,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: submission.id,
          message:
            "Thank you for your submission! Our team will review it soon.",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating submission:", error);
    return NextResponse.json(
      { success: false, errors: ["An error occurred. Please try again."] },
      { status: 500 }
    );
  }
}
