import { inngest } from "../client";
import { db } from "@/db";
import { evaluations } from "@/db/schema";
import { and, eq, lt } from "drizzle-orm";

/**
 * Cleanup Stuck Evaluations
 *
 * Marks evaluations stuck in `running` for more than 30 minutes as `failed`.
 *
 * Why this exists: when a step in run-evaluation throws and Inngest exhausts
 * retries, the function's `onFailure` is supposed to mark the row as failed.
 * But onFailure can itself fail silently (DB blip, Inngest infra issue), and
 * it only matches "the most recent running eval for this model" — which is
 * wrong if a later run for the same model started in parallel. Either path
 * leaves rows stuck at status=running with no completedAt.
 *
 * Mirrors `scripts/fix-stuck-evals.ts`. Runs every 15 minutes so the UI
 * "Live progress" panel never shows fake forever-running evals.
 */
export const cleanupStuckEvals = inngest.createFunction(
  {
    id: "cleanup-stuck-evals",
    retries: 1,
    triggers: [{ cron: "*/15 * * * *" }], // every 15 minutes
  },
  async ({ step }) => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const stuck = await step.run("find-stuck-evals", async () => {
      return db
        .select({
          id: evaluations.id,
          modelId: evaluations.modelId,
          completedTestCases: evaluations.completedTestCases,
          totalTestCases: evaluations.totalTestCases,
          startedAt: evaluations.startedAt,
        })
        .from(evaluations)
        .where(
          and(
            eq(evaluations.status, "running"),
            lt(evaluations.startedAt, thirtyMinutesAgo)
          )
        );
    });

    if (stuck.length === 0) {
      return { stuckCount: 0 };
    }

    await step.run("mark-stuck-failed", async () => {
      for (const e of stuck) {
        await db
          .update(evaluations)
          .set({
            status: "failed",
            errorMessage: "Auto-cleanup: stuck in 'running' for >30min (Inngest function likely failed silently)",
            completedAt: new Date(),
          })
          .where(eq(evaluations.id, e.id));
      }
    });

    return {
      stuckCount: stuck.length,
      cleanedIds: stuck.map((e) => e.id),
    };
  }
);
