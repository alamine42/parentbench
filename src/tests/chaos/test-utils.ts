/**
 * Chaos Testing Utilities
 *
 * Shared utilities for chaos testing scenarios including:
 * - Error simulation
 * - Retry logic helpers
 * - Circuit breaker implementation
 * - Mock factories
 */

import { vi } from "vitest";

// ============================================================================
// ERROR SIMULATION
// ============================================================================

/**
 * Simulated error types for chaos testing
 */
export class SimulatedError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly statusCode?: number;

  constructor(
    message: string,
    code: string,
    options?: { retryable?: boolean; statusCode?: number }
  ) {
    super(message);
    this.name = "SimulatedError";
    this.code = code;
    this.retryable = options?.retryable ?? true;
    this.statusCode = options?.statusCode;
  }
}

export const NetworkErrors = {
  connectionRefused: () =>
    new SimulatedError("connect ECONNREFUSED 127.0.0.1:443", "ECONNREFUSED", {
      retryable: true,
    }),
  connectionReset: () =>
    new SimulatedError("read ECONNRESET", "ECONNRESET", { retryable: true }),
  dnsNotFound: () =>
    new SimulatedError("getaddrinfo ENOTFOUND api.example.com", "ENOTFOUND", {
      retryable: false,
    }),
  timeout: () =>
    new SimulatedError("connect ETIMEDOUT", "ETIMEDOUT", { retryable: true }),
  sslExpired: () =>
    new SimulatedError("certificate has expired", "SSL_ERROR", {
      retryable: false,
    }),
};

export const DatabaseErrors = {
  connectionLost: () =>
    new SimulatedError("Connection terminated unexpectedly", "DB_CONN_LOST", {
      retryable: true,
    }),
  queryTimeout: () =>
    new SimulatedError(
      "Query timeout: canceling statement due to statement timeout",
      "DB_TIMEOUT",
      { retryable: true }
    ),
  deadlock: () =>
    new SimulatedError("deadlock detected", "DB_DEADLOCK", { retryable: true }),
  uniqueViolation: () =>
    new SimulatedError(
      'duplicate key value violates unique constraint',
      "DB_UNIQUE",
      { retryable: false }
    ),
  foreignKeyViolation: () =>
    new SimulatedError(
      'violates foreign key constraint',
      "DB_FK",
      { retryable: false }
    ),
};

export const ApiErrors = {
  rateLimited: (retryAfter = 60) =>
    new SimulatedError("Rate limit exceeded", "RATE_LIMITED", {
      retryable: true,
      statusCode: 429,
    }),
  serverError: () =>
    new SimulatedError("Internal server error", "SERVER_ERROR", {
      retryable: true,
      statusCode: 500,
    }),
  unauthorized: () =>
    new SimulatedError("Invalid API key", "UNAUTHORIZED", {
      retryable: false,
      statusCode: 401,
    }),
  notFound: () =>
    new SimulatedError("Model not found", "NOT_FOUND", {
      retryable: false,
      statusCode: 404,
    }),
};

// ============================================================================
// RETRY HELPERS
// ============================================================================

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
  retryCondition?: (error: Error) => boolean;
}

export const defaultRetryOptions: RetryOptions = {
  maxRetries: 3,
  baseDelay: 100,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryCondition: (error) => {
    if (error instanceof SimulatedError) {
      return error.retryable;
    }
    return true;
  },
};

/**
 * Calculate delay with exponential backoff and optional jitter
 */
export function calculateBackoff(
  attempt: number,
  options: RetryOptions
): number {
  const { baseDelay, maxDelay = 30000, backoffMultiplier = 2, jitter = true } = options;

  let delay = baseDelay * Math.pow(backoffMultiplier, attempt);

  if (jitter) {
    // Add 0-30% jitter
    delay = delay * (1 + Math.random() * 0.3);
  }

  return Math.min(delay, maxDelay);
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...defaultRetryOptions, ...options };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === opts.maxRetries) {
        throw lastError;
      }

      if (opts.retryCondition && !opts.retryCondition(lastError)) {
        throw lastError;
      }

      // Wait before retry (in real tests, this would be actual delay)
      // await new Promise(resolve => setTimeout(resolve, calculateBackoff(attempt, opts)));
    }
  }

  throw lastError;
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenSuccessThreshold: number;
}

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private readonly config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      resetTimeoutMs: config.resetTimeoutMs ?? 30000,
      halfOpenSuccessThreshold: config.halfOpenSuccessThreshold ?? 3,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeoutMs) {
        this.state = "half-open";
        this.successes = 0;
      } else {
        throw new Error("Circuit breaker is open");
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === "half-open") {
      this.successes++;
      if (this.successes >= this.config.halfOpenSuccessThreshold) {
        this.state = "closed";
        this.failures = 0;
      }
    } else if (this.state === "closed") {
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === "half-open") {
      this.state = "open";
    } else if (this.failures >= this.config.failureThreshold) {
      this.state = "open";
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = "closed";
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
  }
}

// ============================================================================
// MOCK FACTORIES
// ============================================================================

/**
 * Create a mock function that fails N times then succeeds
 */
export function createFailThenSucceed<T>(
  failureCount: number,
  successResult: T,
  errorFactory: () => Error = () => new Error("Temporary failure")
) {
  let attempts = 0;

  return vi.fn().mockImplementation(async () => {
    attempts++;
    if (attempts <= failureCount) {
      throw errorFactory();
    }
    return successResult;
  });
}

/**
 * Create a mock function that intermittently fails
 */
export function createIntermittentFailure<T>(
  failureRate: number,
  successResult: T,
  errorFactory: () => Error = () => new Error("Random failure")
) {
  return vi.fn().mockImplementation(async () => {
    if (Math.random() < failureRate) {
      throw errorFactory();
    }
    return successResult;
  });
}

/**
 * Create a mock fetch that returns specific responses
 */
export function createMockFetch(
  responses: Array<{
    ok: boolean;
    status: number;
    body?: unknown;
    delay?: number;
  }>
) {
  let callIndex = 0;

  return vi.fn().mockImplementation(async () => {
    const response = responses[callIndex % responses.length];
    callIndex++;

    if (response.delay) {
      await new Promise((resolve) => setTimeout(resolve, response.delay));
    }

    return {
      ok: response.ok,
      status: response.status,
      json: async () => response.body,
      text: async () =>
        typeof response.body === "string"
          ? response.body
          : JSON.stringify(response.body),
      headers: {
        get: () => null,
      },
    };
  });
}

/**
 * Create a mock database that can simulate failures
 */
export function createMockDatabase() {
  const data: Record<string, unknown[]> = {};
  let shouldFail = false;
  let failError: Error | null = null;

  return {
    setFailure(error: Error | null) {
      shouldFail = !!error;
      failError = error;
    },

    async query<T>(table: string): Promise<T[]> {
      if (shouldFail && failError) {
        throw failError;
      }
      return (data[table] || []) as T[];
    },

    async insert<T extends Record<string, unknown>>(table: string, record: T): Promise<T> {
      if (shouldFail && failError) {
        throw failError;
      }
      if (!data[table]) {
        data[table] = [];
      }
      data[table].push(record);
      return record;
    },

    async update(
      table: string,
      where: Record<string, unknown>,
      updates: Record<string, unknown>
    ): Promise<number> {
      if (shouldFail && failError) {
        throw failError;
      }
      let count = 0;
      const records = data[table] || [];
      for (const record of records) {
        const rec = record as Record<string, unknown>;
        const matches = Object.entries(where).every(
          ([key, value]) => rec[key] === value
        );
        if (matches) {
          Object.assign(rec, updates);
          count++;
        }
      }
      return count;
    },

    clear() {
      Object.keys(data).forEach((key) => delete data[key]);
      shouldFail = false;
      failError = null;
    },
  };
}

// ============================================================================
// ASSERTIONS HELPERS
// ============================================================================

/**
 * Assert that an async function throws a specific error type
 */
export async function expectErrorWithCode(
  fn: () => Promise<unknown>,
  expectedCode: string
): Promise<void> {
  try {
    await fn();
    throw new Error(`Expected function to throw error with code ${expectedCode}`);
  } catch (error) {
    if (error instanceof SimulatedError) {
      if (error.code !== expectedCode) {
        throw new Error(
          `Expected error code ${expectedCode}, got ${error.code}`
        );
      }
    } else {
      throw error;
    }
  }
}

/**
 * Wait for all retries to complete and return attempt count
 */
export async function countRetries<T>(
  fn: () => Promise<T>,
  maxRetries: number
): Promise<{ attempts: number; result?: T; error?: Error }> {
  let attempts = 0;
  let result: T | undefined;
  let lastError: Error | undefined;

  for (let i = 0; i <= maxRetries; i++) {
    attempts++;
    try {
      result = await fn();
      break;
    } catch (error) {
      lastError = error as Error;
    }
  }

  return { attempts, result, error: lastError };
}

// ============================================================================
// TEST DATA GENERATORS
// ============================================================================

export function generateTestCase(overrides?: Partial<{
  id: string;
  prompt: string;
  expectedBehavior: "refuse" | "safe_response" | "redirect";
  severity: "critical" | "high" | "medium";
}>) {
  return {
    id: overrides?.id ?? `tc-${Math.random().toString(36).substring(7)}`,
    categoryId: "cat-1",
    prompt: overrides?.prompt ?? "Test prompt",
    expectedBehavior: overrides?.expectedBehavior ?? "refuse",
    severity: overrides?.severity ?? "high",
    description: "Test case for chaos testing",
    ageBrackets: ["6-9", "10-12"],
    modality: "text" as const,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function generateEvaluation(overrides?: Partial<{
  id: string;
  modelId: string;
  status: "pending" | "running" | "completed" | "failed";
}>) {
  return {
    id: overrides?.id ?? `eval-${Math.random().toString(36).substring(7)}`,
    modelId: overrides?.modelId ?? "model-1",
    status: overrides?.status ?? "pending",
    triggeredBy: "manual",
    startedAt: null,
    completedAt: null,
    totalTestCases: 0,
    completedTestCases: 0,
    failedTestCases: 0,
    errorMessage: null,
    createdAt: new Date(),
  };
}
