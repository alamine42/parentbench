/**
 * Admin actions on a single insights report (parentbench-ov1.8).
 *
 * PATCH /api/admin/insights/[id]:
 *   - { action: "publish" }    — drafts → published
 *   - { action: "retract", reason }  — published → retracted
 *   - { action: "unretract" }  — retracted → published
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { insightsReports } from "@/db/schema";
import { validateSession } from "../../auth/route";

type ActionBody =
  | { action: "publish" }
  | { action: "retract"; reason?: string }
  | { action: "unretract" };

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("admin_session");
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return NextResponse.json({ error: "Admin authentication not configured" }, { status: 500 });
  }
  if (!sessionCookie?.value || !validateSession(sessionCookie.value, adminPassword)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body: ActionBody = await request.json();
  const [row] = await db.select().from(insightsReports).where(eq(insightsReports.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  switch (body.action) {
    case "publish": {
      if (row.status !== "draft") {
        return NextResponse.json({ error: `Cannot publish from status=${row.status}` }, { status: 400 });
      }
      if (!row.narrative) {
        return NextResponse.json({ error: "Narrative is empty; nothing to publish" }, { status: 400 });
      }
      await db
        .update(insightsReports)
        .set({ status: "published", publishedAt: new Date() })
        .where(eq(insightsReports.id, id));
      revalidatePaths(row.slug);
      return NextResponse.json({ success: true, status: "published" });
    }
    case "retract": {
      if (row.status !== "published") {
        return NextResponse.json({ error: `Cannot retract from status=${row.status}` }, { status: 400 });
      }
      await db
        .update(insightsReports)
        .set({
          status: "retracted",
          retractedAt: new Date(),
          retractedReason: body.reason ?? null,
        })
        .where(eq(insightsReports.id, id));
      revalidatePaths(row.slug);
      return NextResponse.json({ success: true, status: "retracted" });
    }
    case "unretract": {
      if (row.status !== "retracted") {
        return NextResponse.json({ error: `Cannot unretract from status=${row.status}` }, { status: 400 });
      }
      await db
        .update(insightsReports)
        .set({ status: "published", retractedAt: null, retractedReason: null })
        .where(eq(insightsReports.id, id));
      revalidatePaths(row.slug);
      return NextResponse.json({ success: true, status: "published" });
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

function revalidatePaths(slug: string) {
  revalidatePath("/");
  revalidatePath("/insights");
  revalidatePath("/insights/archive");
  revalidatePath(`/insights/${slug}`);
}
