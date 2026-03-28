import { NextRequest, NextResponse } from "next/server";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID;

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    if (!RESEND_API_KEY) {
      console.error("[Newsletter] RESEND_API_KEY not configured");
      return NextResponse.json(
        { error: "Newsletter service not configured" },
        { status: 500 }
      );
    }

    if (!RESEND_AUDIENCE_ID) {
      console.error("[Newsletter] RESEND_AUDIENCE_ID not configured");
      return NextResponse.json(
        { error: "Newsletter audience not configured" },
        { status: 500 }
      );
    }

    // Add contact to Resend audience
    const response = await fetch(
      `https://api.resend.com/audiences/${RESEND_AUDIENCE_ID}/contacts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          unsubscribed: false,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[Newsletter] Resend API error:", error);

      // Handle duplicate email gracefully
      if (response.status === 409 || error.includes("already exists")) {
        return NextResponse.json(
          { success: true, message: "Already subscribed" },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { error: "Failed to subscribe" },
        { status: 500 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: "Successfully subscribed",
      id: data.id,
    });
  } catch (error) {
    console.error("[Newsletter] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
