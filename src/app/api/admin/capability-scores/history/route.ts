/**
 * Read-only history endpoint for a (modelId, benchmark) pair.
 * Returns rows newest-first including superseded ones.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { modelCapabilityScores } from "@/db/schema";
import { validateSession } from "../../auth/route";
import { CAPABILITY_BENCHMARKS, type CapabilityBenchmark } from "@/lib/capability/validation";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("admin_session");
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return NextResponse.json({ error: "Admin authentication not configured" }, { status: 500 });
  }
  if (!sessionCookie?.value || !validateSession(sessionCookie.value, adminPassword)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const modelId = url.searchParams.get("modelId");
  const benchmark = url.searchParams.get("benchmark") as CapabilityBenchmark | null;
  if (!modelId || !benchmark || !CAPABILITY_BENCHMARKS.includes(benchmark)) {
    return NextResponse.json({ error: "modelId and benchmark are required" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(modelCapabilityScores)
    .where(
      and(
        eq(modelCapabilityScores.modelId, modelId),
        eq(modelCapabilityScores.benchmark, benchmark)
      )
    )
    .orderBy(desc(modelCapabilityScores.recordedAt));

  return NextResponse.json({ rows });
}
