/**
 * Chaos Testing Suite
 *
 * This module provides comprehensive chaos testing for the ParentBench application.
 *
 * Test Categories:
 * - database-failures.test.ts: PostgreSQL/Neon database chaos scenarios
 * - inngest-failures.test.ts: Background job processing chaos scenarios
 * - external-api-failures.test.ts: AI provider API chaos scenarios
 * - network-failures.test.ts: Network infrastructure chaos scenarios
 * - email-failures.test.ts: Resend email service chaos scenarios
 *
 * Usage:
 * ```bash
 * # Run all chaos tests
 * npm test -- --grep "Chaos"
 *
 * # Run specific chaos test category
 * npm test -- src/tests/chaos/database-failures.test.ts
 * npm test -- src/tests/chaos/inngest-failures.test.ts
 * npm test -- src/tests/chaos/external-api-failures.test.ts
 * npm test -- src/tests/chaos/network-failures.test.ts
 * npm test -- src/tests/chaos/email-failures.test.ts
 * ```
 *
 * Chaos Testing Philosophy:
 *
 * These tests simulate real-world failure scenarios to ensure:
 * 1. Graceful degradation - The app continues to function partially when parts fail
 * 2. Data integrity - No data loss or corruption during failures
 * 3. Proper error handling - Clear, actionable error messages
 * 4. Recovery - The system can recover when services come back online
 * 5. No cascading failures - One failure doesn't bring down the entire system
 *
 * Best Practices for Adding New Chaos Tests:
 *
 * 1. Identify failure modes for each external dependency
 * 2. Test both the failure AND the recovery path
 * 3. Verify error messages are user-friendly
 * 4. Ensure sensitive data is not leaked in error messages
 * 5. Test retry logic with exponential backoff
 * 6. Verify circuit breaker behavior
 * 7. Test partial success scenarios
 */

// Export test utilities for use in other test files
export * from "./test-utils";

// Document the test structure
export const CHAOS_TEST_CATEGORIES = {
  DATABASE: {
    file: "database-failures.test.ts",
    scenarios: [
      "Connection loss",
      "Query timeouts",
      "Transaction failures",
      "Constraint violations",
      "Deadlock detection",
      "Recovery scenarios",
    ],
  },
  INNGEST: {
    file: "inngest-failures.test.ts",
    scenarios: [
      "Job retry behavior",
      "Step failures",
      "Timeout handling",
      "Concurrency limits",
      "Event delivery failures",
      "OnFailure handler",
      "Partial success handling",
    ],
  },
  EXTERNAL_API: {
    file: "external-api-failures.test.ts",
    scenarios: [
      "Rate limiting (429)",
      "Server errors (5xx)",
      "Timeouts",
      "Invalid responses",
      "Authentication failures",
      "Model not found",
      "Content safety errors",
      "Provider-specific error handling",
    ],
  },
  NETWORK: {
    file: "network-failures.test.ts",
    scenarios: [
      "DNS resolution failures",
      "Connection errors",
      "SSL/TLS errors",
      "Partial data transfer",
      "Proxy failures",
      "Circuit breaker pattern",
    ],
  },
  EMAIL: {
    file: "email-failures.test.ts",
    scenarios: [
      "Rate limiting",
      "Authentication failures",
      "Invalid email addresses",
      "Template rendering failures",
      "Delivery failures",
      "Fallback behavior",
    ],
  },
} as const;

/**
 * Failure injection helpers for integration tests
 *
 * These can be used in integration tests to simulate failures
 * in a controlled manner.
 */
export const FailureInjection = {
  /**
   * Simulate database unavailability
   */
  injectDatabaseFailure: (mockDb: { setFailure: (err: Error) => void }) => {
    mockDb.setFailure(new Error("Database connection lost"));
  },

  /**
   * Simulate API rate limiting
   */
  injectRateLimit: (mockFetch: ReturnType<typeof import("vitest").vi.fn>) => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: { get: () => "60" },
      text: async () => JSON.stringify({ error: { message: "Rate limited" } }),
    });
  },

  /**
   * Simulate network timeout
   */
  injectTimeout: (mockFetch: ReturnType<typeof import("vitest").vi.fn>) => {
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new DOMException("Aborted", "AbortError")),
            100
          )
        )
    );
  },

  /**
   * Simulate email service failure
   */
  injectEmailFailure: (mockFetch: ReturnType<typeof import("vitest").vi.fn>) => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () =>
        JSON.stringify({ message: "Email service temporarily unavailable" }),
    });
  },
};
