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
 * Send a report card email
 */
export async function sendReportCardEmail(
  params: ReportCardEmailParams
): Promise<void> {
  // TODO: Implement report card email
  console.log("Would send report card email:", params);
}

/**
 * Send a certification status email
 */
export async function sendCertificationEmail(
  params: CertificationEmailParams
): Promise<void> {
  // TODO: Implement certification email
  console.log("Would send certification email:", params);
}
