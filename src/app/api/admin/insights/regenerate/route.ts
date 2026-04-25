/**
 * POST /api/admin/insights/regenerate (parentbench-ov1.8)
 *
 * Bypasses the debounce window and triggers a fresh report generation.
 * Sends the `insights/regenerate-requested` event directly to Inngest.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "../../auth/route";
import { inngest } from "@/inngest/client";

export async function POST(_request: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("admin_session");
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return NextResponse.json({ error: "Admin authentication not configured" }, { status: 500 });
  }
  if (!sessionCookie?.value || !validateSession(sessionCookie.value, adminPassword)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await inngest.send({
    name: "insights/regenerate-requested",
    data: {
      triggerReason: "manual",
      triggeringEvent: { source: "admin-regen-button", at: new Date().toISOString() },
    },
  });

  return NextResponse.json({ success: true, eventIds: result.ids });
}
