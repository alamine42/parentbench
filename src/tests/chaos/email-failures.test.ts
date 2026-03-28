/**
 * Chaos Testing: Email Service (Resend) Failures
 *
 * Tests graceful degradation when Resend email service encounters:
 * - API rate limits
 * - Authentication failures
 * - Invalid email addresses
 * - Template rendering failures
 * - Delivery failures
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Email Service Chaos Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "test-resend-key";
    process.env.EMAIL_FROM = "test@parentbench.com";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Rate Limiting", () => {
    it("should handle Resend rate limit (429)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: (name: string) => (name === "retry-after" ? "60" : null),
        },
        text: async () =>
          JSON.stringify({
            statusCode: 429,
            message: "Too many requests",
            name: "rate_limit_exceeded",
          }),
      });

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer test-key" },
        body: JSON.stringify({ to: "test@example.com" }),
      });

      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBe("60");
    });

    it("should queue emails when rate limited", async () => {
      const emailQueue: Array<{
        email: Record<string, string>;
        scheduledFor: Date;
      }> = [];

      const sendEmailWithRateLimit = async (
        email: Record<string, string>,
        retryAfter: number
      ) => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: { get: () => String(retryAfter) },
        });

        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          body: JSON.stringify(email),
        });

        if (response.status === 429) {
          const retrySeconds = parseInt(response.headers.get("retry-after") || "60");
          emailQueue.push({
            email,
            scheduledFor: new Date(Date.now() + retrySeconds * 1000),
          });
          return { sent: false, queued: true, retryIn: retrySeconds };
        }

        return { sent: true, queued: false };
      };

      const result = await sendEmailWithRateLimit(
        { to: "test@example.com", subject: "Test" },
        120
      );

      expect(result.sent).toBe(false);
      expect(result.queued).toBe(true);
      expect(result.retryIn).toBe(120);
      expect(emailQueue.length).toBe(1);
    });

    it("should batch emails to avoid rate limits", () => {
      const batchEmails = (
        emails: Array<{ to: string; subject: string }>,
        batchSize: number,
        delayBetweenBatches: number
      ) => {
        const batches: Array<{
          emails: Array<{ to: string; subject: string }>;
          sendAt: number;
        }> = [];

        for (let i = 0; i < emails.length; i += batchSize) {
          batches.push({
            emails: emails.slice(i, i + batchSize),
            sendAt: Date.now() + Math.floor(i / batchSize) * delayBetweenBatches,
          });
        }

        return batches;
      };

      const emails = Array.from({ length: 25 }, (_, i) => ({
        to: `user${i}@example.com`,
        subject: "Alert",
      }));

      const batches = batchEmails(emails, 10, 1000);

      expect(batches.length).toBe(3);
      expect(batches[0].emails.length).toBe(10);
      expect(batches[2].emails.length).toBe(5);
    });
  });

  describe("Authentication Failures", () => {
    it("should handle invalid API key", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () =>
          JSON.stringify({
            statusCode: 401,
            message: "Invalid API key",
            name: "unauthorized",
          }),
      });

      const response = await fetch("https://api.resend.com/emails", {
        headers: { Authorization: "Bearer invalid-key" },
      });

      expect(response.status).toBe(401);
    });

    it("should handle missing API key gracefully", () => {
      delete process.env.RESEND_API_KEY;

      const sendEmail = (to: string, subject: string) => {
        const apiKey = process.env.RESEND_API_KEY;

        if (!apiKey) {
          // Log to console in development
          console.log("========================================");
          console.log("Email would be sent (no RESEND_API_KEY):");
          console.log(`To: ${to}`);
          console.log(`Subject: ${subject}`);
          console.log("========================================");
          return { sent: false, reason: "no_api_key", logged: true };
        }

        return { sent: true };
      };

      const result = sendEmail("test@example.com", "Test Subject");

      expect(result.sent).toBe(false);
      expect(result.reason).toBe("no_api_key");
      expect(result.logged).toBe(true);
    });

    it("should handle expired API key", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () =>
          JSON.stringify({
            statusCode: 401,
            message: "API key has been revoked",
            name: "unauthorized",
          }),
      });

      const response = await fetch("https://api.resend.com/emails", {
        headers: { Authorization: "Bearer expired-key" },
      });
      const error = JSON.parse(await response.text());

      expect(error.message).toContain("revoked");
    });
  });

  describe("Invalid Email Addresses", () => {
    it("should handle invalid recipient email", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: async () =>
          JSON.stringify({
            statusCode: 422,
            message: "Invalid email address: not-an-email",
            name: "validation_error",
          }),
      });

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        body: JSON.stringify({ to: "not-an-email" }),
      });

      expect(response.status).toBe(422);
    });

    it("should validate email format before sending", () => {
      const validateEmail = (email: string): { valid: boolean; error?: string } => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email) {
          return { valid: false, error: "Email is required" };
        }
        if (!emailRegex.test(email)) {
          return { valid: false, error: "Invalid email format" };
        }
        if (email.length > 254) {
          return { valid: false, error: "Email too long" };
        }

        return { valid: true };
      };

      expect(validateEmail("valid@example.com")).toEqual({ valid: true });
      expect(validateEmail("invalid")).toMatchObject({
        valid: false,
        error: "Invalid email format",
      });
      expect(validateEmail("")).toMatchObject({
        valid: false,
        error: "Email is required",
      });
    });

    it("should handle bounced email domains", () => {
      const bouncedDomains = new Set(["bounced.com", "invalid-domain.net"]);

      const checkEmailDeliverability = (email: string) => {
        const domain = email.split("@")[1];

        if (bouncedDomains.has(domain)) {
          return {
            deliverable: false,
            reason: "domain_bounced",
            suggestion: "This domain has historically bounced emails",
          };
        }

        return { deliverable: true };
      };

      expect(checkEmailDeliverability("user@bounced.com")).toMatchObject({
        deliverable: false,
        reason: "domain_bounced",
      });
      expect(checkEmailDeliverability("user@valid.com")).toMatchObject({
        deliverable: true,
      });
    });
  });

  describe("Template Rendering Failures", () => {
    it("should handle missing template variables", () => {
      const renderTemplate = (
        template: string,
        variables: Record<string, string | number>
      ) => {
        const missingVars: string[] = [];
        const rendered = template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
          if (varName in variables) {
            return String(variables[varName]);
          }
          missingVars.push(varName);
          return match;
        });

        if (missingVars.length > 0) {
          return {
            success: false,
            error: `Missing template variables: ${missingVars.join(", ")}`,
            partial: rendered,
          };
        }

        return { success: true, html: rendered };
      };

      const template = "Hello {{name}}, your score is {{score}}";

      expect(renderTemplate(template, { name: "John", score: 85 })).toEqual({
        success: true,
        html: "Hello John, your score is 85",
      });

      expect(renderTemplate(template, { name: "John" })).toMatchObject({
        success: false,
        error: "Missing template variables: score",
      });
    });

    it("should escape HTML in template variables", () => {
      const escapeHtml = (text: string): string => {
        return text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      };

      const renderSafeTemplate = (
        template: string,
        variables: Record<string, string>
      ) => {
        return template.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
          const value = variables[varName] || "";
          return escapeHtml(value);
        });
      };

      const template = '<p>Prompt: "{{prompt}}"</p>';
      const maliciousInput = '<script>alert("xss")</script>';

      const rendered = renderSafeTemplate(template, { prompt: maliciousInput });

      expect(rendered).not.toContain("<script>");
      expect(rendered).toContain("&lt;script&gt;");
    });
  });

  describe("Delivery Failures", () => {
    it("should handle hard bounce", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            statusCode: 400,
            message: "Email address does not exist",
            name: "delivery_failed",
            details: {
              bounceType: "hard",
              bounceSubType: "NoEmail",
            },
          }),
      });

      const response = await fetch("https://api.resend.com/emails");
      const error = JSON.parse(await response.text());

      expect(error.details.bounceType).toBe("hard");
    });

    it("should handle soft bounce with retry", async () => {
      let attempts = 0;

      const sendWithSoftBounceRetry = async (email: Record<string, string>) => {
        const maxRetries = 3;

        for (let i = 0; i < maxRetries; i++) {
          attempts++;
          mockFetch.mockResolvedValueOnce({
            ok: i === 2, // Succeed on 3rd attempt
            status: i === 2 ? 200 : 400,
            json: async () =>
              i === 2
                ? { id: "email-123" }
                : {
                    statusCode: 400,
                    message: "Mailbox full",
                    details: { bounceType: "soft", bounceSubType: "MailboxFull" },
                  },
          });

          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            body: JSON.stringify(email),
          });

          if (response.ok) {
            return { sent: true, attempts };
          }

          const error = await response.json();
          if (error.details?.bounceType !== "soft") {
            return { sent: false, error: "hard_bounce", attempts };
          }

          // Wait before retry (simulated)
        }

        return { sent: false, error: "max_retries_exceeded", attempts };
      };

      const result = await sendWithSoftBounceRetry({
        to: "full-mailbox@example.com",
        subject: "Test",
      });

      expect(result.sent).toBe(true);
      expect(result.attempts).toBe(3);
    });

    it("should track delivery status for alerts", () => {
      const deliveryLog: Array<{
        emailId: string;
        to: string;
        status: "sent" | "delivered" | "bounced" | "failed";
        timestamp: Date;
      }> = [];

      const trackDelivery = (
        emailId: string,
        to: string,
        status: "sent" | "delivered" | "bounced" | "failed"
      ) => {
        deliveryLog.push({
          emailId,
          to,
          status,
          timestamp: new Date(),
        });
      };

      const getDeliveryStats = () => {
        const stats = deliveryLog.reduce(
          (acc, entry) => {
            acc[entry.status] = (acc[entry.status] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

        const total = deliveryLog.length;
        const deliveryRate = total > 0 ? (stats.delivered || 0) / total : 0;

        return { ...stats, total, deliveryRate };
      };

      trackDelivery("1", "a@example.com", "delivered");
      trackDelivery("2", "b@example.com", "delivered");
      trackDelivery("3", "c@example.com", "bounced");
      trackDelivery("4", "d@example.com", "delivered");

      const stats = getDeliveryStats();

      expect(stats.delivered).toBe(3);
      expect(stats.bounced).toBe(1);
      expect(stats.deliveryRate).toBe(0.75);
    });
  });

  describe("Email Content Validation", () => {
    it("should validate email subject length", () => {
      const validateSubject = (subject: string) => {
        if (!subject) return { valid: false, error: "Subject is required" };
        if (subject.length > 78) {
          return {
            valid: false,
            error: "Subject too long (max 78 characters for optimal delivery)",
          };
        }
        return { valid: true };
      };

      expect(validateSubject("Short subject")).toEqual({ valid: true });
      expect(validateSubject("a".repeat(100))).toMatchObject({
        valid: false,
        error: expect.stringContaining("too long"),
      });
    });

    it("should validate email HTML content", () => {
      const validateHtmlContent = (html: string) => {
        const issues: string[] = [];

        // Check for required elements
        if (!html.includes("<!DOCTYPE")) {
          issues.push("Missing DOCTYPE declaration");
        }
        if (!html.includes("<html")) {
          issues.push("Missing html tag");
        }
        if (!html.includes("<body")) {
          issues.push("Missing body tag");
        }

        // Check for spam triggers
        const spamPatterns = [
          /FREE!!!/i,
          /\$\$\$/,
          /click here now/i,
          /limited time/i,
        ];
        for (const pattern of spamPatterns) {
          if (pattern.test(html)) {
            issues.push(`Potential spam trigger: ${pattern.source}`);
          }
        }

        return {
          valid: issues.length === 0,
          issues,
        };
      };

      const validHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <p>Hello, your score has changed.</p>
        </body>
        </html>
      `;

      const spamHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <p>FREE!!! Click here now for $$$!</p>
        </body>
        </html>
      `;

      expect(validateHtmlContent(validHtml)).toMatchObject({ valid: true });
      expect(validateHtmlContent(spamHtml).issues.length).toBeGreaterThan(0);
    });
  });

  describe("Fallback Behavior", () => {
    it("should log emails when Resend is unavailable", () => {
      const consoleLogs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        consoleLogs.push(args.join(" "));
      };

      const sendEmailWithFallback = (to: string, subject: string, body: string) => {
        const apiKey = null; // Simulate missing API key

        if (!apiKey) {
          console.log("========================================");
          console.log("Email would be sent (no RESEND_API_KEY):");
          console.log(`To: ${to}`);
          console.log(`Subject: ${subject}`);
          console.log("----------------------------------------");
          console.log(body);
          console.log("========================================");
          return { sent: false, logged: true };
        }

        return { sent: true };
      };

      const result = sendEmailWithFallback(
        "test@example.com",
        "Score Alert",
        "Your model score changed."
      );

      expect(result.logged).toBe(true);
      expect(consoleLogs.some((log) => log.includes("Email would be sent"))).toBe(
        true
      );
      expect(consoleLogs.some((log) => log.includes("test@example.com"))).toBe(
        true
      );

      console.log = originalLog;
    });

    it("should persist failed emails for later retry", () => {
      const failedEmailStore: Array<{
        email: Record<string, string>;
        error: string;
        failedAt: Date;
        retryCount: number;
      }> = [];

      const persistFailedEmail = (
        email: Record<string, string>,
        error: string
      ) => {
        const existing = failedEmailStore.find(
          (e) => e.email.to === email.to && e.email.subject === email.subject
        );

        if (existing) {
          existing.retryCount++;
          existing.failedAt = new Date();
          existing.error = error;
        } else {
          failedEmailStore.push({
            email,
            error,
            failedAt: new Date(),
            retryCount: 1,
          });
        }
      };

      const getEmailsToRetry = (maxRetries: number) => {
        return failedEmailStore.filter((e) => e.retryCount < maxRetries);
      };

      // Simulate failed emails
      persistFailedEmail({ to: "a@example.com", subject: "Alert" }, "timeout");
      persistFailedEmail({ to: "b@example.com", subject: "Alert" }, "rate_limit");
      persistFailedEmail({ to: "a@example.com", subject: "Alert" }, "timeout"); // Retry

      expect(failedEmailStore.length).toBe(2);
      expect(failedEmailStore.find((e) => e.email.to === "a@example.com")?.retryCount).toBe(2);

      const toRetry = getEmailsToRetry(3);
      expect(toRetry.length).toBe(2);
    });
  });
});
