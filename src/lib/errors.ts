/**
 * Custom Error Classes for ParentBench
 *
 * Provides structured error handling with error codes, HTTP status mappings,
 * and user-friendly messages.
 */

// ============================================================================
// ERROR CODES
// ============================================================================

export const ErrorCode = {
  // Authentication & Authorization (1xxx)
  UNAUTHORIZED: "AUTH_001",
  FORBIDDEN: "AUTH_002",
  INVALID_API_KEY: "AUTH_003",
  EXPIRED_API_KEY: "AUTH_004",
  RATE_LIMITED: "AUTH_005",

  // Validation (2xxx)
  VALIDATION_ERROR: "VAL_001",
  INVALID_MODEL_SLUG: "VAL_002",
  INVALID_CATEGORY: "VAL_003",
  INVALID_EMAIL: "VAL_004",
  MISSING_REQUIRED_FIELD: "VAL_005",

  // Resource Not Found (3xxx)
  MODEL_NOT_FOUND: "RES_001",
  EVALUATION_NOT_FOUND: "RES_002",
  SCORE_NOT_FOUND: "RES_003",
  TEST_CASE_NOT_FOUND: "RES_004",
  CERTIFICATION_NOT_FOUND: "RES_005",
  PROVIDER_NOT_FOUND: "RES_006",

  // External Service Errors (4xxx)
  MODEL_API_ERROR: "EXT_001",
  DATABASE_ERROR: "EXT_002",
  EMAIL_SERVICE_ERROR: "EXT_003",
  PAYMENT_SERVICE_ERROR: "EXT_004",

  // Evaluation Errors (5xxx)
  EVALUATION_FAILED: "EVAL_001",
  ADAPTER_NOT_FOUND: "EVAL_002",
  ADAPTER_NOT_CONFIGURED: "EVAL_003",
  JUDGE_EVALUATION_FAILED: "EVAL_004",
  SCORE_COMPUTATION_FAILED: "EVAL_005",

  // Business Logic (6xxx)
  CERTIFICATION_ALREADY_EXISTS: "BIZ_001",
  EVALUATION_IN_PROGRESS: "BIZ_002",
  ALREADY_SUBSCRIBED: "BIZ_003",
  INVALID_CERTIFICATION_STATE: "BIZ_004",

  // Internal (9xxx)
  INTERNAL_ERROR: "INT_001",
  NOT_IMPLEMENTED: "INT_002",
  CONFIGURATION_ERROR: "INT_003",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// ============================================================================
// BASE ERROR CLASS
// ============================================================================

export class ParentBenchError extends Error {
  public readonly code: ErrorCodeType;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: ErrorCodeType = ErrorCode.INTERNAL_ERROR,
    statusCode: number = 500,
    details?: Record<string, unknown>,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = "ParentBenchError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

// ============================================================================
// SPECIFIC ERROR CLASSES
// ============================================================================

/**
 * 400 Bad Request errors
 */
export class ValidationError extends ParentBenchError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, details);
    this.name = "ValidationError";
  }
}

/**
 * 401 Unauthorized errors
 */
export class UnauthorizedError extends ParentBenchError {
  constructor(message: string = "Authentication required") {
    super(message, ErrorCode.UNAUTHORIZED, 401);
    this.name = "UnauthorizedError";
  }
}

/**
 * 403 Forbidden errors
 */
export class ForbiddenError extends ParentBenchError {
  constructor(message: string = "Access denied") {
    super(message, ErrorCode.FORBIDDEN, 403);
    this.name = "ForbiddenError";
  }
}

/**
 * 404 Not Found errors
 */
export class NotFoundError extends ParentBenchError {
  constructor(
    resource: string,
    identifier?: string,
    code: ErrorCodeType = ErrorCode.MODEL_NOT_FOUND
  ) {
    const message = identifier
      ? `${resource} '${identifier}' not found`
      : `${resource} not found`;
    super(message, code, 404, { resource, identifier });
    this.name = "NotFoundError";
  }
}

/**
 * 429 Rate Limited errors
 */
export class RateLimitError extends ParentBenchError {
  public readonly retryAfter?: number;

  constructor(message: string = "Rate limit exceeded", retryAfter?: number) {
    super(message, ErrorCode.RATE_LIMITED, 429, { retryAfter });
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

/**
 * 500 Internal Server errors
 */
export class InternalError extends ParentBenchError {
  constructor(
    message: string = "An internal error occurred",
    details?: Record<string, unknown>
  ) {
    super(message, ErrorCode.INTERNAL_ERROR, 500, details, false);
    this.name = "InternalError";
  }
}

/**
 * 502 External Service errors
 */
export class ExternalServiceError extends ParentBenchError {
  public readonly service: string;

  constructor(
    service: string,
    message: string,
    code: ErrorCodeType = ErrorCode.MODEL_API_ERROR,
    details?: Record<string, unknown>
  ) {
    super(`${service}: ${message}`, code, 502, { service, ...details });
    this.name = "ExternalServiceError";
    this.service = service;
  }
}

/**
 * Database errors
 */
export class DatabaseError extends ExternalServiceError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("Database", message, ErrorCode.DATABASE_ERROR, details);
    this.name = "DatabaseError";
  }
}

/**
 * Model adapter errors
 */
export class AdapterError extends ParentBenchError {
  public readonly modelSlug: string;

  constructor(
    modelSlug: string,
    message: string,
    code: ErrorCodeType = ErrorCode.ADAPTER_NOT_FOUND
  ) {
    super(message, code, 500, { modelSlug });
    this.name = "AdapterError";
    this.modelSlug = modelSlug;
  }
}

/**
 * Evaluation errors
 */
export class EvaluationError extends ParentBenchError {
  public readonly evaluationId?: string;

  constructor(
    message: string,
    evaluationId?: string,
    details?: Record<string, unknown>
  ) {
    super(message, ErrorCode.EVALUATION_FAILED, 500, {
      evaluationId,
      ...details,
    });
    this.name = "EvaluationError";
    this.evaluationId = evaluationId;
  }
}

// ============================================================================
// ERROR HELPERS
// ============================================================================

/**
 * Check if an error is a ParentBenchError
 */
export function isParentBenchError(error: unknown): error is ParentBenchError {
  return error instanceof ParentBenchError;
}

/**
 * Check if an error is operational (expected) vs programmer error
 */
export function isOperationalError(error: unknown): boolean {
  if (isParentBenchError(error)) {
    return error.isOperational;
  }
  return false;
}

/**
 * Convert any error to a ParentBenchError
 */
export function toParentBenchError(error: unknown): ParentBenchError {
  if (isParentBenchError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalError(error.message, {
      originalName: error.name,
      stack: error.stack,
    });
  }

  return new InternalError("An unknown error occurred", {
    originalError: String(error),
  });
}

/**
 * Create a safe error response for API endpoints
 */
export function createErrorResponse(error: unknown): {
  statusCode: number;
  body: { error: { code: string; message: string; details?: unknown } };
} {
  const pbError = toParentBenchError(error);

  // Don't expose internal error details in production
  const isProduction = process.env.NODE_ENV === "production";
  const shouldHideDetails = !pbError.isOperational && isProduction;

  return {
    statusCode: pbError.statusCode,
    body: {
      error: {
        code: pbError.code,
        message: shouldHideDetails
          ? "An internal error occurred"
          : pbError.message,
        ...(pbError.details &&
          !shouldHideDetails && { details: pbError.details }),
      },
    },
  };
}

/**
 * Log an error with appropriate severity
 */
export function logError(error: unknown, context?: Record<string, unknown>) {
  const pbError = toParentBenchError(error);

  const logData = {
    code: pbError.code,
    message: pbError.message,
    statusCode: pbError.statusCode,
    isOperational: pbError.isOperational,
    details: pbError.details,
    context,
    stack: pbError.stack,
  };

  if (pbError.isOperational) {
    console.warn("[ParentBench Error]", JSON.stringify(logData));
  } else {
    console.error("[ParentBench Critical Error]", JSON.stringify(logData));
  }
}
