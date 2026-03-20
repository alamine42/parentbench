import { inngest } from "../client";
import { db } from "@/db";
import { alerts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { sendAlertEmail } from "@/lib/email";

/**
 * Send score change alerts to subscribed users
 */
export const sendAlerts = inngest.createFunction(
  {
    id: "send-alerts",
    retries: 3,
    triggers: [{ event: "alert/score-changed" }],
  },
  async ({ event, step }) => {
    const { modelId, modelSlug, modelName, previousScore, newScore, changeAmount } =
      event.data;

    // Get all active alerts for this model
    const activeAlerts = await step.run("get-alerts", async () => {
      return db
        .select()
        .from(alerts)
        .where(and(eq(alerts.modelId, modelId), eq(alerts.isActive, true)));
    });

    if (activeAlerts.length === 0) {
      return { sent: 0, message: "No active alerts for this model" };
    }

    // Send email to each subscriber
    let sentCount = 0;
    const errors: string[] = [];

    for (const alert of activeAlerts) {
      try {
        await step.run(`send-email-${alert.id}`, async () => {
          await sendAlertEmail({
            to: alert.email,
            modelName,
            modelSlug,
            previousScore,
            newScore,
            changeAmount,
            unsubscribeToken: alert.unsubscribeToken,
          });

          // Update last notified time
          await db
            .update(alerts)
            .set({ lastNotifiedAt: new Date() })
            .where(eq(alerts.id, alert.id));
        });

        sentCount++;
      } catch (error) {
        errors.push(
          `Failed to send to ${alert.email}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    return {
      sent: sentCount,
      total: activeAlerts.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
);
