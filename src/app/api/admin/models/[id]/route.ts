import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { models, providers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateSession } from "../../auth/route";
import { inngest } from "@/inngest/client";

const VALID_EVAL_TIERS = ["active", "standard", "maintenance", "paused"] as const;
type EvalTier = (typeof VALID_EVAL_TIERS)[number];

/**
 * GET /api/admin/models/[id]
 * Get a single model by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Verify admin authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("admin_session");
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return NextResponse.json(
      { error: "Admin authentication not configured" },
      { status: 500 }
    );
  }

  if (!sessionCookie?.value || !validateSession(sessionCookie.value, adminPassword)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const [model] = await db
      .select({
        id: models.id,
        name: models.name,
        slug: models.slug,
        description: models.description,
        releaseDate: models.releaseDate,
        parameterCount: models.parameterCount,
        capabilities: models.capabilities,
        isActive: models.isActive,
        evalTier: models.evalTier,
        providerId: models.providerId,
        provider: {
          id: providers.id,
          name: providers.name,
          slug: providers.slug,
        },
        createdAt: models.createdAt,
        updatedAt: models.updatedAt,
      })
      .from(models)
      .innerJoin(providers, eq(models.providerId, providers.id))
      .where(eq(models.id, id))
      .limit(1);

    if (!model) {
      return NextResponse.json(
        { error: "Model not found" },
        { status: 404 }
      );
    }

    // Get all providers for the dropdown
    const allProviders = await db
      .select({
        id: providers.id,
        name: providers.name,
        slug: providers.slug,
      })
      .from(providers)
      .orderBy(providers.name);

    return NextResponse.json({ model, providers: allProviders });
  } catch (error) {
    console.error("Failed to fetch model:", error);
    return NextResponse.json(
      { error: "Failed to fetch model" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/models/[id]
 * Update a model
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Verify admin authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("admin_session");
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return NextResponse.json(
      { error: "Admin authentication not configured" },
      { status: 500 }
    );
  }

  if (!sessionCookie?.value || !validateSession(sessionCookie.value, adminPassword)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const {
      name,
      slug,
      description,
      releaseDate,
      parameterCount,
      capabilities,
      isActive,
      evalTier,
      providerId,
    } = body;

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Name must be a non-empty string" },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }

    if (slug !== undefined) {
      if (typeof slug !== "string" || slug.trim().length === 0) {
        return NextResponse.json(
          { error: "Slug must be a non-empty string" },
          { status: 400 }
        );
      }
      // Check for slug uniqueness (excluding current model)
      const [existingModel] = await db
        .select({ id: models.id })
        .from(models)
        .where(eq(models.slug, slug.trim()))
        .limit(1);

      if (existingModel && existingModel.id !== id) {
        return NextResponse.json(
          { error: "A model with this slug already exists" },
          { status: 400 }
        );
      }
      updateData.slug = slug.trim();
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (releaseDate !== undefined) {
      updateData.releaseDate = releaseDate ? new Date(releaseDate) : null;
    }

    if (parameterCount !== undefined) {
      updateData.parameterCount = parameterCount?.trim() || null;
    }

    if (capabilities !== undefined) {
      if (!Array.isArray(capabilities)) {
        return NextResponse.json(
          { error: "Capabilities must be an array" },
          { status: 400 }
        );
      }
      updateData.capabilities = capabilities;
    }

    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    if (evalTier !== undefined) {
      if (!VALID_EVAL_TIERS.includes(evalTier)) {
        return NextResponse.json(
          { error: `Invalid evalTier. Must be one of: ${VALID_EVAL_TIERS.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.evalTier = evalTier as EvalTier;
    }

    if (providerId !== undefined) {
      // Verify provider exists
      const [provider] = await db
        .select({ id: providers.id })
        .from(providers)
        .where(eq(providers.id, providerId))
        .limit(1);

      if (!provider) {
        return NextResponse.json(
          { error: "Provider not found" },
          { status: 400 }
        );
      }
      updateData.providerId = providerId;
    }

    // Read prior state so we can detect a transition to active tier
    // (parentbench-ov1.9 — emit eval/active-tier-promoted only on real change)
    const [prior] = await db
      .select({ evalTier: models.evalTier, isActive: models.isActive, slug: models.slug })
      .from(models)
      .where(eq(models.id, id))
      .limit(1);

    // Perform update
    const [updatedModel] = await db
      .update(models)
      .set(updateData)
      .where(eq(models.id, id))
      .returning();

    if (!updatedModel) {
      return NextResponse.json(
        { error: "Model not found" },
        { status: 404 }
      );
    }

    // Best-effort event emission — never block the response
    if (prior) {
      const promotedToActive =
        prior.evalTier !== "active" &&
        updatedModel.evalTier === "active" &&
        updatedModel.isActive;
      if (promotedToActive) {
        try {
          await inngest.send({
            name: "eval/active-tier-promoted",
            data: {
              modelId: id,
              modelSlug: updatedModel.slug,
              previousTier: prior.evalTier,
              newTier: "active",
            },
          });
        } catch (err) {
          console.error("Failed to emit eval/active-tier-promoted:", err);
        }
      }
    }

    return NextResponse.json({ success: true, model: updatedModel });
  } catch (error) {
    console.error("Failed to update model:", error);
    return NextResponse.json(
      { error: "Failed to update model" },
      { status: 500 }
    );
  }
}
