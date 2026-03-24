/**
 * Email Service
 *
 * Handles sending transactional emails for ParentBench.
 * Uses a simple interface that can be backed by any email provider
 * (SendGrid, Resend, AWS SES, etc.)
 */

// ============================================================================
// TYPES
// ============================================================================

export interface AlertEmailParams {
  to: string;
  modelName: string;
  modelSlug: string;
  previousScore: number;
  newScore: number;
  changeAmount: number;
  unsubscribeToken: string;
}

export interface ReportCardEmailParams {
  to: string;
  modelName: string;
  modelSlug: string;
  overallScore: number;
  overallGrade: string;
  reportUrl: string;
}

export interface CertificationEmailParams {
  to: string;
  modelName: string;
  certificationStatus: "approved" | "rejected" | "revoked";
  reason?: string;
}

export interface SubmissionStatusEmailParams {
  to: string;
  submissionId: string;
  prompt: string;
  status: "approved" | "rejected";
  reviewNotes?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Escape HTML special characters to prevent XSS/injection in emails
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

function getAlertEmailHtml(params: AlertEmailParams): string {
  const {
    modelName,
    modelSlug,
    previousScore,
    newScore,
    changeAmount,
    unsubscribeToken,
  } = params;

  const direction = changeAmount > 0 ? "improved" : "decreased";
  const emoji = changeAmount > 0 ? "📈" : "📉";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://parentbench.com";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ParentBench Score Alert</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #6366f1; margin: 0;">ParentBench</h1>
    <p style="color: #6b7280; margin: 5px 0;">AI Child Safety Ratings</p>
  </div>

  <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 16px;">${emoji} Score Alert: ${modelName}</h2>
    <p style="margin: 0 0 16px;">
      The safety score for <strong>${modelName}</strong> has ${direction} by ${Math.abs(changeAmount).toFixed(1)} points.
    </p>
    <div style="display: flex; gap: 20px; margin: 20px 0;">
      <div style="flex: 1; text-align: center; padding: 16px; background: white; border-radius: 8px;">
        <div style="color: #6b7280; font-size: 14px;">Previous Score</div>
        <div style="font-size: 28px; font-weight: bold; color: #374151;">${previousScore.toFixed(1)}</div>
      </div>
      <div style="flex: 1; text-align: center; padding: 16px; background: white; border-radius: 8px;">
        <div style="color: #6b7280; font-size: 14px;">New Score</div>
        <div style="font-size: 28px; font-weight: bold; color: ${changeAmount > 0 ? "#22c55e" : "#ef4444"};">${newScore.toFixed(1)}</div>
      </div>
    </div>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${baseUrl}/model/${modelSlug}" style="display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500;">
      View Full Report
    </a>
  </div>

  <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; color: #9ca3af; font-size: 12px; text-align: center;">
    <p>You're receiving this because you subscribed to alerts for ${modelName}.</p>
    <p>
      <a href="${baseUrl}/unsubscribe/${unsubscribeToken}" style="color: #6b7280;">
        Unsubscribe from these alerts
      </a>
    </p>
    <p>&copy; ${new Date().getFullYear()} ParentBench. Helping parents make informed decisions about AI.</p>
  </div>
</body>
</html>
  `.trim();
}

function getAlertEmailText(params: AlertEmailParams): string {
  const {
    modelName,
    modelSlug,
    previousScore,
    newScore,
    changeAmount,
    unsubscribeToken,
  } = params;

  const direction = changeAmount > 0 ? "improved" : "decreased";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://parentbench.com";

  return `
ParentBench Score Alert

The safety score for ${modelName} has ${direction} by ${Math.abs(changeAmount).toFixed(1)} points.

Previous Score: ${previousScore.toFixed(1)}
New Score: ${newScore.toFixed(1)}

View the full report: ${baseUrl}/model/${modelSlug}

---

You're receiving this because you subscribed to alerts for ${modelName}.
Unsubscribe: ${baseUrl}/unsubscribe/${unsubscribeToken}
  `.trim();
}

// ============================================================================
// EMAIL SENDING
// ============================================================================

/**
 * Send an alert email about score changes
 */
export async function sendAlertEmail(params: AlertEmailParams): Promise<void> {
  const { to } = params;

  // Check for email provider configuration
  const resendApiKey = process.env.RESEND_API_KEY;

  if (resendApiKey) {
    // Use Resend
    await sendViaResend(resendApiKey, {
      to,
      subject: `ParentBench Alert: ${params.modelName} Score Changed`,
      html: getAlertEmailHtml(params),
      text: getAlertEmailText(params),
    });
  } else {
    // Log for development
    console.log("========================================");
    console.log("Email would be sent (no RESEND_API_KEY):");
    console.log(`To: ${to}`);
    console.log(`Subject: ParentBench Alert: ${params.modelName} Score Changed`);
    console.log("----------------------------------------");
    console.log(getAlertEmailText(params));
    console.log("========================================");
  }
}

/**
 * Send an email via Resend
 */
async function sendViaResend(
  apiKey: string,
  options: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }
): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "ParentBench <alerts@parentbench.com>",
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }
}

/**
 * Send a report card email.
 *
 * NOTE: Not yet implemented. Throws an error to prevent silent failures.
 * Enable once RESEND_API_KEY is configured and templates are complete.
 */
export async function sendReportCardEmail(
  params: ReportCardEmailParams
): Promise<{ sent: false; reason: string }> {
  // Log the attempt for debugging
  console.log("[Email] Report card email requested (not implemented):", {
    to: params.to,
    modelName: params.modelName,
    overallGrade: params.overallGrade,
  });

  // Return a clear indicator that email wasn't sent
  // This allows callers to handle gracefully without throwing
  return {
    sent: false,
    reason: "Report card emails are not yet implemented. The feature will be available in a future update.",
  };
}

/**
 * Send a certification status email.
 *
 * NOTE: Not yet implemented. Returns a clear indicator to prevent silent failures.
 * Enable once RESEND_API_KEY is configured and templates are complete.
 */
export async function sendCertificationEmail(
  params: CertificationEmailParams
): Promise<{ sent: false; reason: string }> {
  // Log the attempt for debugging
  console.log("[Email] Certification email requested (not implemented):", {
    to: params.to,
    modelName: params.modelName,
    certificationStatus: params.certificationStatus,
  });

  // Return a clear indicator that email wasn't sent
  return {
    sent: false,
    reason: "Certification emails are not yet implemented. The feature will be available in a future update.",
  };
}

// ============================================================================
// SUBMISSION STATUS EMAIL
// ============================================================================

function getSubmissionStatusEmailHtml(
  params: SubmissionStatusEmailParams
): string {
  const { submissionId, prompt, status, reviewNotes } = params;
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://parentbench.com";

  const isApproved = status === "approved";
  const emoji = isApproved ? "✅" : "❌";
  const statusColor = isApproved ? "#22c55e" : "#ef4444";
  const statusText = isApproved ? "Approved" : "Not Accepted";

  // Truncate and escape prompt for display (prevent XSS/injection)
  const truncatedPrompt = escapeHtml(
    prompt.length > 100 ? prompt.slice(0, 100) + "..." : prompt
  );
  const safeReviewNotes = reviewNotes ? escapeHtml(reviewNotes) : null;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ParentBench Submission Update</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #6366f1; margin: 0;">ParentBench</h1>
    <p style="color: #6b7280; margin: 5px 0;">Community Test Case Submission</p>
  </div>

  <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 16px;">${emoji} Submission ${statusText}</h2>
    <p style="margin: 0 0 16px;">
      Your test case submission has been reviewed by our team.
    </p>

    <div style="background: white; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <div style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Your Submission</div>
      <div style="margin-top: 8px; color: #374151; font-style: italic;">"${truncatedPrompt}"</div>
    </div>

    <div style="background: white; border-radius: 8px; padding: 16px; border-left: 4px solid ${statusColor};">
      <div style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Status</div>
      <div style="margin-top: 4px; font-size: 18px; font-weight: bold; color: ${statusColor};">${statusText}</div>
      ${
        safeReviewNotes
          ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
          <div style="color: #6b7280; font-size: 12px;">Reviewer Notes</div>
          <div style="margin-top: 4px; color: #374151;">${safeReviewNotes}</div>
        </div>`
          : ""
      }
    </div>

    ${
      isApproved
        ? `<p style="margin: 16px 0 0; color: #22c55e; font-weight: 500;">
        🎉 Your test case has been added to ParentBench and will help evaluate AI safety for children!
      </p>`
        : `<p style="margin: 16px 0 0; color: #6b7280;">
        Thank you for your contribution. We encourage you to submit additional test cases that meet our guidelines.
      </p>`
    }
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${baseUrl}/test-cases" style="display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500;">
      View Test Cases
    </a>
  </div>

  <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; color: #9ca3af; font-size: 12px; text-align: center;">
    <p>Submission ID: ${submissionId.slice(0, 8)}</p>
    <p>&copy; ${new Date().getFullYear()} ParentBench. Helping parents make informed decisions about AI.</p>
  </div>
</body>
</html>
  `.trim();
}

function getSubmissionStatusEmailText(
  params: SubmissionStatusEmailParams
): string {
  const { submissionId, prompt, status, reviewNotes } = params;
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://parentbench.com";

  const isApproved = status === "approved";
  const statusText = isApproved ? "Approved" : "Not Accepted";

  // Truncate prompt for display
  const truncatedPrompt =
    prompt.length > 100 ? prompt.slice(0, 100) + "..." : prompt;

  return `
ParentBench Submission Update

Your test case submission has been reviewed.

Status: ${statusText}

Your Submission:
"${truncatedPrompt}"

${reviewNotes ? `Reviewer Notes: ${reviewNotes}` : ""}

${isApproved ? "Your test case has been added to ParentBench and will help evaluate AI safety for children!" : "Thank you for your contribution. We encourage you to submit additional test cases that meet our guidelines."}

View all test cases: ${baseUrl}/test-cases

---

Submission ID: ${submissionId.slice(0, 8)}
ParentBench - Helping parents make informed decisions about AI
  `.trim();
}

/**
 * Send a submission status email
 */
export async function sendSubmissionStatusEmail(
  params: SubmissionStatusEmailParams
): Promise<void> {
  const { to } = params;

  const resendApiKey = process.env.RESEND_API_KEY;
  // Use consistent terminology: "Approved" or "Not Accepted" (matches email body)
  const statusText = params.status === "approved" ? "Approved" : "Not Accepted";

  if (resendApiKey) {
    await sendViaResend(resendApiKey, {
      to,
      subject: `ParentBench: Your Submission Has Been ${statusText}`,
      html: getSubmissionStatusEmailHtml(params),
      text: getSubmissionStatusEmailText(params),
    });
  } else {
    console.log("========================================");
    console.log("Email would be sent (no RESEND_API_KEY):");
    console.log(`To: ${to}`);
    console.log(`Subject: ParentBench: Your Submission Has Been ${statusText}`);
    console.log("----------------------------------------");
    console.log(getSubmissionStatusEmailText(params));
    console.log("========================================");
  }
}
