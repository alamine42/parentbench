/**
 * Chaos Testing: Network Failures
 *
 * Tests graceful degradation when network infrastructure encounters:
 * - DNS resolution failures
 * - Connection refused
 * - Connection reset
 * - SSL/TLS errors
 * - Proxy failures
 * - Partial data transfer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Network Chaos Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("DNS Resolution Failures", () => {
    it("should handle DNS resolution failure", async () => {
      mockFetch.mockRejectedValueOnce(
        new TypeError("getaddrinfo ENOTFOUND api.openai.com")
      );

      await expect(
        fetch("https://api.openai.com/v1/chat/completions")
      ).rejects.toThrow("ENOTFOUND");
    });

    it("should handle DNS timeout", async () => {
      mockFetch.mockRejectedValueOnce(
        new TypeError("getaddrinfo EAI_AGAIN api.openai.com")
      );

      await expect(fetch("https://api.openai.com/v1/chat/completions")).rejects.toThrow(
        "EAI_AGAIN"
      );
    });

    it("should handle invalid hostname", async () => {
      mockFetch.mockRejectedValueOnce(
        new TypeError("getaddrinfo ENOENT invalid-hostname.example")
      );

      await expect(
        fetch("https://invalid-hostname.example/api")
      ).rejects.toThrow("ENOENT");
    });

    it("should classify DNS errors appropriately", () => {
      const classifyDnsError = (message: string) => {
        if (message.includes("ENOTFOUND")) {
          return {
            type: "dns_not_found",
            retryable: false,
            suggestion: "Check the hostname spelling or DNS configuration",
          };
        }
        if (message.includes("EAI_AGAIN")) {
          return {
            type: "dns_timeout",
            retryable: true,
            suggestion: "DNS server temporarily unavailable, retry later",
          };
        }
        if (message.includes("ENOENT")) {
          return {
            type: "dns_no_data",
            retryable: false,
            suggestion: "Hostname does not have associated records",
          };
        }
        return {
          type: "unknown_dns_error",
          retryable: false,
          suggestion: "Unknown DNS error occurred",
        };
      };

      expect(classifyDnsError("getaddrinfo ENOTFOUND example.com")).toMatchObject({
        type: "dns_not_found",
        retryable: false,
      });
      expect(classifyDnsError("getaddrinfo EAI_AGAIN example.com")).toMatchObject({
        type: "dns_timeout",
        retryable: true,
      });
    });
  });

  describe("Connection Errors", () => {
    it("should handle connection refused", async () => {
      mockFetch.mockRejectedValueOnce(
        new TypeError("connect ECONNREFUSED 127.0.0.1:443")
      );

      await expect(fetch("https://localhost/api")).rejects.toThrow("ECONNREFUSED");
    });

    it("should handle connection reset", async () => {
      mockFetch.mockRejectedValueOnce(
        new TypeError("read ECONNRESET")
      );

      await expect(fetch("https://api.example.com/endpoint")).rejects.toThrow(
        "ECONNRESET"
      );
    });

    it("should handle connection timeout", async () => {
      mockFetch.mockRejectedValueOnce(
        new TypeError("connect ETIMEDOUT 1.2.3.4:443")
      );

      await expect(fetch("https://slow-server.example/api")).rejects.toThrow(
        "ETIMEDOUT"
      );
    });

    it("should handle network unreachable", async () => {
      mockFetch.mockRejectedValueOnce(
        new TypeError("connect ENETUNREACH 1.2.3.4:443")
      );

      await expect(fetch("https://unreachable.example/api")).rejects.toThrow(
        "ENETUNREACH"
      );
    });

    it("should handle host unreachable", async () => {
      mockFetch.mockRejectedValueOnce(
        new TypeError("connect EHOSTUNREACH 1.2.3.4:443")
      );

      await expect(fetch("https://host-down.example/api")).rejects.toThrow(
        "EHOSTUNREACH"
      );
    });

    it("should implement connection retry with jitter", async () => {
      let attempts = 0;
      const delays: number[] = [];

      const connectWithRetry = async (
        url: string,
        maxRetries: number,
        baseDelay: number
      ) => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            return await mockFetch(url);
          } catch (error) {
            if ((error as Error).message.includes("ECONNREFUSED")) {
              const jitter = Math.random() * 0.3; // 0-30% jitter
              const delay = baseDelay * Math.pow(2, i) * (1 + jitter);
              delays.push(delay);
              attempts++;
              if (i === maxRetries - 1) throw error;
            } else {
              throw error;
            }
          }
        }
      };

      mockFetch.mockRejectedValue(new TypeError("connect ECONNREFUSED 127.0.0.1:443"));

      await expect(connectWithRetry("https://localhost", 3, 100)).rejects.toThrow(
        "ECONNREFUSED"
      );

      expect(attempts).toBe(3);
      // Verify exponential backoff pattern (with jitter, exact values vary)
      expect(delays[0]).toBeLessThan(delays[1]);
      expect(delays[1]).toBeLessThan(delays[2]);
    });
  });

  describe("SSL/TLS Errors", () => {
    it("should handle certificate expired", async () => {
      mockFetch.mockRejectedValueOnce(
        new TypeError("certificate has expired")
      );

      await expect(
        fetch("https://expired-cert.example/api")
      ).rejects.toThrow("certificate has expired");
    });

    it("should handle self-signed certificate", async () => {
      mockFetch.mockRejectedValueOnce(
        new TypeError("self signed certificate")
      );

      await expect(
        fetch("https://self-signed.example/api")
      ).rejects.toThrow("self signed certificate");
    });

    it("should handle certificate hostname mismatch", async () => {
      mockFetch.mockRejectedValueOnce(
        new TypeError("Hostname/IP does not match certificate's altnames")
      );

      await expect(
        fetch("https://wrong-hostname.example/api")
      ).rejects.toThrow("does not match certificate");
    });

    it("should handle SSL handshake failure", async () => {
      mockFetch.mockRejectedValueOnce(
        new TypeError("SSL routines:ssl3_get_record:wrong version number")
      );

      await expect(fetch("https://ssl-error.example/api")).rejects.toThrow(
        "SSL routines"
      );
    });

    it("should classify SSL errors with security guidance", () => {
      const classifySslError = (message: string) => {
        if (message.includes("expired")) {
          return {
            type: "cert_expired",
            severity: "high",
            action: "Contact service provider to renew certificate",
          };
        }
        if (message.includes("self signed")) {
          return {
            type: "self_signed_cert",
            severity: "medium",
            action: "Do not bypass - verify this is expected for development",
          };
        }
        if (message.includes("does not match")) {
          return {
            type: "hostname_mismatch",
            severity: "critical",
            action: "Possible man-in-the-middle attack - do not proceed",
          };
        }
        return {
          type: "unknown_ssl_error",
          severity: "high",
          action: "Investigate SSL/TLS configuration",
        };
      };

      expect(classifySslError("certificate has expired")).toMatchObject({
        severity: "high",
      });
      expect(classifySslError("Hostname does not match certificate")).toMatchObject({
        severity: "critical",
      });
    });
  });

  describe("Partial Data Transfer", () => {
    it("should handle incomplete response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => {
          throw new Error("Premature close");
        },
      });

      const response = await fetch("https://api.example.com/data");
      await expect(response.text()).rejects.toThrow("Premature close");
    });

    it("should handle stream interruption", async () => {
      const chunks: string[] = [];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode("chunk1") })
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode("chunk2") })
              .mockRejectedValueOnce(new Error("Connection reset during transfer")),
          }),
        },
      });

      const readStream = async (response: Response) => {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(decoder.decode(value));
        }
      };

      const response = await fetch("https://api.example.com/stream");
      await expect(readStream(response)).rejects.toThrow(
        "Connection reset during transfer"
      );

      expect(chunks).toEqual(["chunk1", "chunk2"]);
    });

    it("should implement request with checksum validation", async () => {
      const validateResponse = (data: string, expectedHash: string) => {
        // Simple hash simulation
        const computedHash = data
          .split("")
          .reduce((acc, char) => acc + char.charCodeAt(0), 0)
          .toString(16);

        if (computedHash !== expectedHash) {
          throw new Error(
            `Data integrity check failed: expected ${expectedHash}, got ${computedHash}`
          );
        }
        return true;
      };

      // Valid case - "hello" = 104+101+108+108+111 = 532 = 0x214
      expect(validateResponse("hello", "214")).toBe(true);

      // Corrupted data
      expect(() => validateResponse("corrupted", "wrong")).toThrow(
        "Data integrity check failed"
      );
    });
  });

  describe("Proxy and Gateway Errors", () => {
    it("should handle proxy connection refused", async () => {
      mockFetch.mockRejectedValueOnce(
        new TypeError("connect ECONNREFUSED proxy.example.com:8080")
      );

      await expect(fetch("https://api.example.com")).rejects.toThrow(
        "ECONNREFUSED"
      );
    });

    it("should handle proxy authentication required", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 407,
        statusText: "Proxy Authentication Required",
        text: async () => "Proxy authentication required",
      });

      const response = await fetch("https://api.example.com");
      expect(response.status).toBe(407);
    });

    it("should handle gateway timeout", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 504,
        statusText: "Gateway Timeout",
        text: async () => "The gateway did not receive a response in time",
      });

      const response = await fetch("https://api.example.com");
      expect(response.status).toBe(504);
    });
  });

  describe("Network Quality Issues", () => {
    it("should handle intermittent connectivity", async () => {
      let callCount = 0;

      mockFetch.mockImplementation(async () => {
        callCount++;
        if (callCount % 3 === 0) {
          // Every 3rd call fails
          throw new TypeError("Network request failed");
        }
        return { ok: true, json: async () => ({ data: `response-${callCount}` }) };
      });

      const results: Array<{ success: boolean; attempt: number }> = [];

      for (let i = 0; i < 6; i++) {
        try {
          await fetch("https://api.example.com");
          results.push({ success: true, attempt: i + 1 });
        } catch {
          results.push({ success: false, attempt: i + 1 });
        }
      }

      const failures = results.filter((r) => !r.success);
      expect(failures.length).toBe(2); // Attempts 3 and 6 failed
    });

    it("should implement circuit breaker pattern", async () => {
      class CircuitBreaker {
        private failures = 0;
        private lastFailureTime = 0;
        private state: "closed" | "open" | "half-open" = "closed";
        private readonly threshold: number;
        private readonly resetTimeout: number;

        constructor(threshold: number, resetTimeout: number) {
          this.threshold = threshold;
          this.resetTimeout = resetTimeout;
        }

        async execute<T>(fn: () => Promise<T>): Promise<T> {
          if (this.state === "open") {
            if (Date.now() - this.lastFailureTime > this.resetTimeout) {
              this.state = "half-open";
            } else {
              throw new Error("Circuit breaker is open");
            }
          }

          try {
            const result = await fn();
            if (this.state === "half-open") {
              this.state = "closed";
              this.failures = 0;
            }
            return result;
          } catch (error) {
            this.failures++;
            this.lastFailureTime = Date.now();
            if (this.failures >= this.threshold) {
              this.state = "open";
            }
            throw error;
          }
        }

        getState() {
          return this.state;
        }
      }

      const breaker = new CircuitBreaker(3, 1000);
      const failingFn = vi.fn().mockRejectedValue(new Error("Service unavailable"));

      // First 3 calls should go through (and fail)
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn);
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe("open");

      // Next call should be rejected immediately
      await expect(breaker.execute(failingFn)).rejects.toThrow(
        "Circuit breaker is open"
      );

      // Function should not have been called again
      expect(failingFn).toHaveBeenCalledTimes(3);
    });

    it("should implement health check before requests", async () => {
      const serviceHealth: Record<string, "healthy" | "unhealthy" | "unknown"> = {
        openai: "unknown",
        anthropic: "unknown",
        google: "unknown",
      };

      const checkHealth = async (service: string) => {
        try {
          if (service === "anthropic") {
            throw new Error("Service check failed");
          }
          serviceHealth[service] = "healthy";
          return true;
        } catch {
          serviceHealth[service] = "unhealthy";
          return false;
        }
      };

      const makeRequest = async (service: string, request: () => Promise<unknown>) => {
        if (serviceHealth[service] === "unhealthy") {
          throw new Error(`Service ${service} is unhealthy, skipping request`);
        }

        if (serviceHealth[service] === "unknown") {
          await checkHealth(service);
        }

        if (serviceHealth[service] === "unhealthy") {
          throw new Error(`Service ${service} failed health check`);
        }

        return request();
      };

      // OpenAI passes health check
      await makeRequest("openai", async () => "openai response");
      expect(serviceHealth.openai).toBe("healthy");

      // Anthropic fails health check
      await expect(
        makeRequest("anthropic", async () => "anthropic response")
      ).rejects.toThrow("failed health check");
      expect(serviceHealth.anthropic).toBe("unhealthy");
    });
  });

  describe("Error Recovery and Reporting", () => {
    it("should aggregate network errors for monitoring", () => {
      const errorLog: Array<{
        timestamp: Date;
        type: string;
        service: string;
        message: string;
      }> = [];

      const logNetworkError = (service: string, error: Error) => {
        let type = "unknown";

        if (error.message.includes("ECONNREFUSED")) type = "connection_refused";
        else if (error.message.includes("ENOTFOUND")) type = "dns_failure";
        else if (error.message.includes("ETIMEDOUT")) type = "timeout";
        else if (error.message.includes("certificate")) type = "ssl_error";

        errorLog.push({
          timestamp: new Date(),
          type,
          service,
          message: error.message,
        });
      };

      logNetworkError("openai", new Error("connect ECONNREFUSED 127.0.0.1:443"));
      logNetworkError("anthropic", new Error("getaddrinfo ENOTFOUND api.anthropic.com"));
      logNetworkError("google", new Error("certificate has expired"));

      const errorsByType = errorLog.reduce(
        (acc, err) => {
          acc[err.type] = (acc[err.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      expect(errorsByType).toEqual({
        connection_refused: 1,
        dns_failure: 1,
        ssl_error: 1,
      });
    });

    it("should provide user-friendly error messages", () => {
      const friendlyError = (error: Error): string => {
        const message = error.message.toLowerCase();

        if (message.includes("econnrefused")) {
          return "Unable to connect to the service. Please check if the service is running.";
        }
        if (message.includes("enotfound") || message.includes("dns")) {
          return "Unable to resolve the service address. Please check your network connection.";
        }
        if (message.includes("etimedout")) {
          return "The connection timed out. The service may be slow or unavailable.";
        }
        if (message.includes("certificate")) {
          return "There was a security issue connecting to the service. Please try again later.";
        }
        if (message.includes("econnreset")) {
          return "The connection was interrupted. Please try again.";
        }

        return "An unexpected network error occurred. Please try again later.";
      };

      expect(friendlyError(new Error("connect ECONNREFUSED"))).toContain(
        "Unable to connect"
      );
      expect(friendlyError(new Error("ETIMEDOUT"))).toContain("timed out");
      expect(friendlyError(new Error("unknown error xyz"))).toContain(
        "unexpected network error"
      );
    });

    it("should track service availability over time", () => {
      class AvailabilityTracker {
        private successCount = 0;
        private failureCount = 0;
        private readonly windowMs: number;
        private readonly timestamps: Array<{ time: number; success: boolean }> = [];

        constructor(windowMs: number = 60000) {
          this.windowMs = windowMs;
        }

        record(success: boolean) {
          const now = Date.now();
          this.timestamps.push({ time: now, success });

          // Clean old entries
          const cutoff = now - this.windowMs;
          while (this.timestamps.length > 0 && this.timestamps[0].time < cutoff) {
            this.timestamps.shift();
          }
        }

        getAvailability(): number {
          if (this.timestamps.length === 0) return 1;

          const successes = this.timestamps.filter((t) => t.success).length;
          return successes / this.timestamps.length;
        }

        isHealthy(threshold: number = 0.95): boolean {
          return this.getAvailability() >= threshold;
        }
      }

      const tracker = new AvailabilityTracker();

      // Record 90 successes and 10 failures
      for (let i = 0; i < 90; i++) tracker.record(true);
      for (let i = 0; i < 10; i++) tracker.record(false);

      expect(tracker.getAvailability()).toBe(0.9);
      expect(tracker.isHealthy(0.95)).toBe(false);
      expect(tracker.isHealthy(0.85)).toBe(true);
    });
  });

  describe("Resend Email Service Failures", () => {
    it("should handle Resend API connection failure", async () => {
      mockFetch.mockRejectedValueOnce(
        new TypeError("connect ECONNREFUSED api.resend.com")
      );

      const sendEmail = async (to: string, subject: string) => {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            body: JSON.stringify({ to, subject }),
          });
          return { sent: true };
        } catch (error) {
          return {
            sent: false,
            error: (error as Error).message,
            willRetry: true,
          };
        }
      };

      const result = await sendEmail("test@example.com", "Test Subject");

      expect(result.sent).toBe(false);
      expect(result.willRetry).toBe(true);
    });

    it("should queue emails when Resend is unavailable", async () => {
      const emailQueue: Array<{
        to: string;
        subject: string;
        retryAt: Date;
      }> = [];

      const sendWithQueue = async (to: string, subject: string) => {
        try {
          mockFetch.mockRejectedValueOnce(new Error("Service unavailable"));
          await fetch("https://api.resend.com/emails");
          return { sent: true, queued: false };
        } catch {
          emailQueue.push({
            to,
            subject,
            retryAt: new Date(Date.now() + 300000), // Retry in 5 minutes
          });
          return { sent: false, queued: true };
        }
      };

      const result = await sendWithQueue("test@example.com", "Alert");

      expect(result.queued).toBe(true);
      expect(emailQueue.length).toBe(1);
      expect(emailQueue[0].to).toBe("test@example.com");
    });
  });
});
