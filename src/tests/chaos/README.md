# Chaos Testing Suite

This directory contains chaos tests for simulating failure scenarios in the ParentBench application. These tests ensure the application handles failures gracefully without crashing or losing data.

## Test Files

| File | Description | Test Count |
|------|-------------|------------|
| `database-failures.test.ts` | PostgreSQL/Neon database failures | 17 |
| `inngest-failures.test.ts` | Background job processing failures | 18 |
| `external-api-failures.test.ts` | AI provider API failures | 30 |
| `network-failures.test.ts` | Network infrastructure failures | 29 |
| `email-failures.test.ts` | Resend email service failures | 18 |
| `test-utils.ts` | Shared utilities for chaos testing | - |

## Running Tests

```bash
# Run all chaos tests
npm test -- src/tests/chaos/

# Run a specific category
npm test -- src/tests/chaos/database-failures.test.ts
npm test -- src/tests/chaos/inngest-failures.test.ts
npm test -- src/tests/chaos/external-api-failures.test.ts
npm test -- src/tests/chaos/network-failures.test.ts
npm test -- src/tests/chaos/email-failures.test.ts

# Run in watch mode
npm run test:watch -- src/tests/chaos/
```

## Test Categories

### Database Failures

Tests for PostgreSQL/Neon serverless database issues:

- **Connection Failures**: Connection refused, timeouts, SSL errors, DNS resolution
- **Query Failures**: Query timeouts, deadlocks, serialization failures
- **Transaction Failures**: Rollback on constraint violations, foreign key violations, connection loss mid-transaction
- **Data Integrity**: Partial write failures, NULL constraint violations
- **Recovery**: Temporary connection loss recovery, cache fallback

### Inngest Failures

Tests for background job processing issues:

- **Retry Behavior**: Max retries, non-retryable errors, exponential backoff
- **Step Failures**: Individual step failures, resume from last successful step
- **Timeout Handling**: Job timeouts, step timeouts, evaluation status updates
- **Concurrency**: Queue behavior, duplicate evaluation prevention
- **Event Delivery**: Send failures, validation failures, missing handlers
- **OnFailure Handler**: Proper cleanup when all retries exhausted

### External API Failures

Tests for AI provider (OpenAI, Anthropic, Google, Together) API issues:

- **Rate Limiting**: 429 errors, retry-after headers, exponential backoff
- **Server Errors**: 500, 502, 503 errors with appropriate retry logic
- **Timeouts**: Request timeouts, abort controller usage
- **Invalid Responses**: Malformed JSON, empty bodies, missing fields
- **Authentication**: Invalid/expired API keys, missing keys
- **Model Errors**: Not found, deprecated models
- **Content Safety**: Policy violation handling

### Network Failures

Tests for network infrastructure issues:

- **DNS Failures**: ENOTFOUND, EAI_AGAIN, ENOENT
- **Connection Errors**: ECONNREFUSED, ECONNRESET, ETIMEDOUT, ENETUNREACH
- **SSL/TLS Errors**: Expired certificates, self-signed, hostname mismatch
- **Partial Transfer**: Incomplete response, stream interruption
- **Proxy Failures**: Proxy connection refused, authentication required
- **Circuit Breaker**: Open/half-open/closed states, health checks

### Email Failures

Tests for Resend email service issues:

- **Rate Limiting**: 429 errors, email queuing, batching
- **Authentication**: Invalid/expired/missing API keys
- **Validation**: Invalid email addresses, template rendering
- **Delivery**: Hard/soft bounces, delivery tracking
- **Fallback**: Console logging when service unavailable

## Test Utilities

The `test-utils.ts` file provides:

```typescript
// Error simulation
NetworkErrors.connectionRefused()
DatabaseErrors.queryTimeout()
ApiErrors.rateLimited(60)

// Retry helpers
await withRetry(fn, { maxRetries: 3, baseDelay: 100 })
calculateBackoff(attempt, options)

// Circuit breaker
const breaker = new CircuitBreaker({ failureThreshold: 5 })
await breaker.execute(fn)

// Mock factories
createFailThenSucceed(3, successResult)
createIntermittentFailure(0.2, successResult)
createMockFetch(responses)
createMockDatabase()

// Test data generators
generateTestCase({ prompt: "test" })
generateEvaluation({ status: "running" })
```

## Writing New Chaos Tests

When adding new chaos tests:

1. **Identify failure modes**: What can go wrong with this dependency?
2. **Test the failure**: Verify proper error handling
3. **Test recovery**: Verify the system recovers when the service returns
4. **Test partial success**: What happens when some operations succeed and others fail?
5. **Verify error messages**: Are they user-friendly? Do they leak sensitive data?
6. **Test retry logic**: Does exponential backoff work correctly?

### Example Test Structure

```typescript
describe("Service X Chaos Tests", () => {
  describe("Connection Failures", () => {
    it("should handle connection refused", async () => {
      // Arrange: Set up mock to fail
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      // Act: Call the function
      const result = await serviceWithErrorHandling();

      // Assert: Verify graceful degradation
      expect(result.error).toBeDefined();
      expect(result.crashed).toBe(false);
    });

    it("should recover from temporary failure", async () => {
      // Arrange: Fail twice, then succeed
      mockFetch
        .mockRejectedValueOnce(new Error("ECONNREFUSED"))
        .mockRejectedValueOnce(new Error("ECONNREFUSED"))
        .mockResolvedValueOnce({ ok: true });

      // Act: Call with retry
      const result = await serviceWithRetry();

      // Assert: Verify eventual success
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });
});
```

## Chaos Testing Philosophy

These tests follow chaos engineering principles:

1. **Define steady state**: Know what "working" looks like
2. **Hypothesize impact**: Predict what happens when things fail
3. **Introduce chaos**: Simulate real-world failures
4. **Verify resilience**: Ensure graceful degradation
5. **Learn and improve**: Fix issues discovered by tests

The goal is not just to verify the application doesn't crash, but to ensure:

- **Data integrity**: No data loss or corruption
- **User experience**: Clear error messages, partial functionality
- **Observability**: Errors are logged with context
- **Recovery**: System self-heals when services return
- **Security**: Sensitive data not leaked in errors
