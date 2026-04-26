/**
 * POST /api/admin/correlation/recompute (parentbench-rg1.2).
 *
 * Bypasses the quarterly cron and triggers an immediate correlation
 * report regeneration via Inngest.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "../../auth/route";
import { inngest } from "@/inngest/client";

export async function POST() {
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
    name: "correlation/regenerate-requested",
    data: { source: "admin-manual", at: new Date().toISOString() },
  });
  return NextResponse.json({ success: true, eventIds: result.ids });
}
