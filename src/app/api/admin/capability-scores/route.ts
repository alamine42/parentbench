/**
 * Admin API for capability benchmark scores (parentbench-rg1.1).
 *
 * GET  — list all live (unsuperseded) rows + coverage per active model
 * POST — append a new score; supersedes any prior live row for the
 *        same (modelId, benchmark) pair in a single transaction
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { modelCapabilityScores, models, providers } from "@/db/schema";
import { validateSession } from "../auth/route";
import {
  validateCapabilityScoreInput,
  type CapabilityScoreInput,
} from "@/lib/capability/validation";
import { computeCoverage, selectLiveScores } from "@/lib/capability/coverage";

async function requireAdmin(): Promise<NextResponse | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("admin_session");
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return NextResponse.json({ error: "Admin authentication not configured" }, { status: 500 });
  }
  if (!sessionCookie?.value || !validateSession(sessionCookie.value, adminPassword)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  // Active-tier models with provider name
  const activeModels = await db
    .select({
      id: models.id,
      slug: models.slug,
      name: models.name,
      provider: providers.name,
      evalTier: models.evalTier,
    })
    .from(models)
    .innerJoin(providers, eq(models.providerId, providers.id))
    .where(and(eq(models.isActive, true), eq(models.evalTier, "active")));

  // All live rows for those models
  const allRows = await db
    .select()
    .from(modelCapabilityScores)
    .where(isNull(modelCapabilityScores.supersededAt));

  const live = selectLiveScores(
    allRows.map((r) => ({
      id: r.id,
      modelId: r.modelId,
      benchmark: r.benchmark,
      score: r.score,
      recordedAt: r.recordedAt,
      supersededAt: r.supersededAt,
    }))
  );
  const coverage = computeCoverage(activeModels.map((m) => m.id), live);

  return NextResponse.json({
    models: activeModels.map((m) => ({
      ...m,
      coverage: coverage.get(m.id),
      liveScores: live
        .filter((r) => r.modelId === m.id)
        .map((r) => ({ benchmark: r.benchmark, score: r.score })),
    })),
    rawRowCount: allRows.length,
  });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: CapabilityScoreInput;
  try {
    body = (await request.json()) as CapabilityScoreInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validation = validateCapabilityScoreInput(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.errors, warnings: validation.warnings },
      { status: 400 }
    );
  }

  // Verify the model exists (defensive — guards against the FK violation
  // returning a less-friendly Postgres error)
  const [model] = await db.select({ id: models.id }).from(models).where(eq(models.id, body.modelId));
  if (!model) {
    return NextResponse.json({ error: "Unknown modelId" }, { status: 400 });
  }

  // Two writes in a transaction: stamp the prior live row's
  // supersededAt, then insert the new row.
  const recordedAt = new Date();
  const adminUser = "admin"; // we don't track per-user identity yet; future hook
  const result = await db.transaction(async (tx) => {
    await tx
      .update(modelCapabilityScores)
      .set({ supersededAt: recordedAt })
      .where(
        and(
          eq(modelCapabilityScores.modelId, body.modelId),
          eq(modelCapabilityScores.benchmark, body.benchmark),
          isNull(modelCapabilityScores.supersededAt)
        )
      );

    const [inserted] = await tx
      .insert(modelCapabilityScores)
      .values({
        modelId: body.modelId,
        benchmark: body.benchmark,
        score: body.score,
        shotSetting: body.shotSetting ?? null,
        benchmarkVariant: body.benchmarkVariant ?? null,
        sourceUrl: body.sourceUrl,
        sourceNote: body.sourceNote ?? null,
        recordedAt,
        recordedBy: adminUser,
      })
      .returning();
    return inserted;
  });

  return NextResponse.json({
    success: true,
    id: result.id,
    warnings: validation.warnings,
  });
}

// History endpoint for a (model, benchmark) pair — useful for the admin
// page's "view history" affordance. Pulled into the same file for
// cohesion; could move to a sub-route later if it grows.
export async function PATCH(request: NextRequest) {
  // Reserved: future "edit metadata of a live row in place" if we ever
  // need it. For v1, edits go through POST (which appends a new row).
  void request;
  return NextResponse.json({ error: "Use POST to record a new score" }, { status: 405 });
}

// Suppress unused-import warning if linter complains
void desc;
void sql;
