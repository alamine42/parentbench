import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

// Session configuration
const SESSION_DURATION_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Create HMAC signature for session data
 * Uses a secret key derived from ADMIN_PASSWORD (not the password itself)
 */
function createSessionSignature(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

/**
 * Verify session signature with timing-safe comparison
 */
function verifySessionSignature(data: string, signature: string, secret: string): boolean {
  const expectedSig = createSessionSignature(data, secret);
  if (signature.length !== expectedSig.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
}

/**
 * Get signing secret from admin password
 * This is NOT the password - it's a derived key for signing
 */
function getSigningSecret(adminPassword: string): string {
  return crypto.createHash("sha256").update(`session-signing-key:${adminPassword}`).digest("hex");
}

/**
 * POST /api/admin/auth
 * Authenticate with admin password and set session cookie
 */
export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      console.error("ADMIN_PASSWORD environment variable not set");
      return NextResponse.json(
        { error: "Admin authentication not configured" },
        { status: 500 }
      );
    }

    // Timing-safe password comparison
    const inputHash = crypto.createHash("sha256").update(password).digest("hex");
    const adminHash = crypto.createHash("sha256").update(adminPassword).digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(adminHash))) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    // Create session with expiry timestamp
    const sessionId = crypto.randomBytes(16).toString("hex");
    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
    const sessionData = `${sessionId}:${expiresAt}`;

    // Sign the session data (signature cannot be forged without the secret)
    const signingSecret = getSigningSecret(adminPassword);
    const signature = createSessionSignature(sessionData, signingSecret);

    // Cookie value: sessionId:expiresAt:signature
    const cookieValue = `${sessionData}:${signature}`;

    // Set secure cookie
    const cookieStore = await cookies();
    const isProduction = process.env.NODE_ENV === "production";

    cookieStore.set("admin_session", cookieValue, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      maxAge: SESSION_DURATION_SECONDS,
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/auth
 * Logout - clear session cookie
 */
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("admin_session");

  return NextResponse.json({ success: true });
}

/**
 * Validate admin session cookie
 * Exported for use in layout auth check
 */
export function validateSession(cookieValue: string, adminPassword: string): boolean {
  try {
    const parts = cookieValue.split(":");
    if (parts.length !== 3) {
      return false;
    }

    const [sessionId, expiresAtStr, signature] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);

    // Check if session is expired
    const now = Math.floor(Date.now() / 1000);
    if (isNaN(expiresAt) || now > expiresAt) {
      return false;
    }

    // Verify signature
    const sessionData = `${sessionId}:${expiresAtStr}`;
    const signingSecret = getSigningSecret(adminPassword);

    return verifySessionSignature(sessionData, signature, signingSecret);
  } catch {
    return false;
  }
}
