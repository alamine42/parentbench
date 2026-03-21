/**
 * Inngest function to send submission status emails
 *
 * Triggered when a submission is approved or rejected.
 * Sends an email to the submitter with the status update.
 */

import { inngest } from "../client";
import { sendSubmissionStatusEmail } from "@/lib/email";

export const sendSubmissionStatusEmailFn = inngest.createFunction(
  {
    id: "send-submission-status-email",
    retries: 3,
    triggers: [{ event: "submission/status-changed" }],
  },
  async ({ event, step }) => {
    const { submissionId, email, prompt, status, reviewNotes } = event.data;

    // Send the email
    await step.run("send-email", async () => {
      await sendSubmissionStatusEmail({
        to: email,
        submissionId,
        prompt,
        status,
        reviewNotes,
      });
    });

    return {
      success: true,
      submissionId,
      status,
      email,
    };
  }
);
