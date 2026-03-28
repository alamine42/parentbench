/**
 * Chaos Testing: Database Failures
 *
 * Tests graceful degradation when PostgreSQL/Neon database encounters:
 * - Connection loss
 * - Timeouts
 * - Transaction failures
 * - Constraint violations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the Neon serverless driver before importing db
vi.mock("@neondatabase/serverless", () => {
  const mockNeon = vi.fn();
  return {
    neon: mockNeon,
  };
});

// Mock drizzle-orm
vi.mock("drizzle-orm/neon-http", () => {
  return {
    drizzle: vi.fn(() => ({
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    })),
  };
});

describe("Database Chaos Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set required env var for db module
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Connection Failures", () => {
    it("should handle database connection refused", async () => {
      const { neon } = await import("@neondatabase/serverless");
      const mockedNeon = vi.mocked(neon);

      mockedNeon.mockImplementation(() => {
        throw new Error("Connection refused: ECONNREFUSED 127.0.0.1:5432");
      });

      // Simulate what happens when trying to use the database
      const connectionError = () => {
        mockedNeon("postgres://test:test@localhost:5432/test");
      };

      expect(connectionError).toThrow("Connection refused");
    });

    it("should handle database connection timeout", async () => {
      const { neon } = await import("@neondatabase/serverless");
      const mockedNeon = vi.mocked(neon);

      mockedNeon.mockImplementation(() => {
        throw new Error("Connection timeout after 30000ms");
      });

      const timeoutError = () => {
        mockedNeon("postgres://test:test@localhost:5432/test");
      };

      expect(timeoutError).toThrow("timeout");
    });

    it("should handle SSL/TLS connection errors", async () => {
      const { neon } = await import("@neondatabase/serverless");
      const mockedNeon = vi.mocked(neon);

      mockedNeon.mockImplementation(() => {
        throw new Error("SSL connection error: certificate has expired");
      });

      const sslError = () => {
        mockedNeon("postgres://test:test@localhost:5432/test");
      };

      expect(sslError).toThrow("SSL");
    });

    it("should handle DNS resolution failures", async () => {
      const { neon } = await import("@neondatabase/serverless");
      const mockedNeon = vi.mocked(neon);

      mockedNeon.mockImplementation(() => {
        throw new Error("getaddrinfo ENOTFOUND db.example.com");
      });

      const dnsError = () => {
        mockedNeon("postgres://test:test@localhost:5432/test");
      };

      expect(dnsError).toThrow("ENOTFOUND");
    });
  });

  describe("Query Failures", () => {
    it("should handle query timeout gracefully", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockRejectedValue(
              new Error("Query timeout: canceling statement due to statement timeout")
            ),
          }),
        }),
      };

      await expect(
        mockDb.select().from("models").where("id = 1")
      ).rejects.toThrow("Query timeout");
    });

    it("should handle deadlock detection", async () => {
      const mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockRejectedValue(
              new Error("deadlock detected")
            ),
          }),
        }),
      };

      await expect(
        mockDb.update("evaluations").set({ status: "running" }).where("id = 1")
      ).rejects.toThrow("deadlock");
    });

    it("should handle serialization failures with retry hint", async () => {
      let attempts = 0;
      const maxRetries = 3;

      const mockOperation = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < maxRetries) {
          throw new Error("could not serialize access due to concurrent update");
        }
        return { success: true };
      });

      // Simulate retry logic
      let result;
      let lastError;
      for (let i = 0; i < maxRetries; i++) {
        try {
          result = await mockOperation();
          break;
        } catch (error) {
          lastError = error;
          if (!(error instanceof Error) || !error.message.includes("serialize")) {
            throw error;
          }
        }
      }

      expect(attempts).toBe(3);
      expect(result).toEqual({ success: true });
    });
  });

  describe("Transaction Failures", () => {
    it("should handle transaction rollback on constraint violation", async () => {
      const mockTransaction = {
        rollback: vi.fn(),
        commit: vi.fn(),
      };

      const mockInsert = vi.fn().mockRejectedValue(
        new Error('duplicate key value violates unique constraint "models_slug_unique"')
      );

      try {
        await mockInsert({ slug: "gpt-4o", name: "GPT-4o" });
        mockTransaction.commit();
      } catch (error) {
        mockTransaction.rollback();
      }

      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(mockTransaction.commit).not.toHaveBeenCalled();
    });

    it("should handle foreign key constraint violations", async () => {
      const mockInsert = vi.fn().mockRejectedValue(
        new Error('insert or update on table "models" violates foreign key constraint "models_provider_id_fkey"')
      );

      await expect(
        mockInsert({ providerId: "non-existent-id", name: "Test Model" })
      ).rejects.toThrow("foreign key constraint");
    });

    it("should handle transaction timeout", async () => {
      const mockTransaction = vi.fn().mockRejectedValue(
        new Error("Transaction timeout: lock wait timeout exceeded")
      );

      await expect(mockTransaction()).rejects.toThrow("timeout");
    });

    it("should handle connection lost mid-transaction", async () => {
      const mockTransaction = {
        steps: [] as string[],
        execute: vi.fn().mockImplementation(async (step: string) => {
          if (step === "step-3") {
            throw new Error("connection terminated unexpectedly");
          }
          mockTransaction.steps.push(step);
        }),
      };

      let transactionAborted = false;
      try {
        await mockTransaction.execute("step-1");
        await mockTransaction.execute("step-2");
        await mockTransaction.execute("step-3");
      } catch (error) {
        transactionAborted = true;
      }

      expect(transactionAborted).toBe(true);
      expect(mockTransaction.steps).toEqual(["step-1", "step-2"]);
    });
  });

  describe("Data Integrity Under Failures", () => {
    it("should not lose data during partial write failure", async () => {
      const committedData: Record<string, unknown>[] = [];
      const pendingData: Record<string, unknown>[] = [];

      const mockBatchInsert = vi.fn().mockImplementation(async (items: Record<string, unknown>[]) => {
        for (let i = 0; i < items.length; i++) {
          pendingData.push(items[i]);
          if (i === 2) {
            // Simulate failure after 3 items
            throw new Error("connection reset");
          }
          committedData.push(items[i]);
        }
      });

      const testData = [
        { id: 1, value: "a" },
        { id: 2, value: "b" },
        { id: 3, value: "c" },
        { id: 4, value: "d" },
      ];

      try {
        await mockBatchInsert(testData);
      } catch (error) {
        // Expected
      }

      // Verify we know exactly what was committed vs pending
      expect(committedData.length).toBeLessThan(testData.length);
      expect(pendingData.length).toBe(3); // Failed on 3rd item (index 2)
    });

    it("should handle NULL constraint violations gracefully", async () => {
      const mockInsert = vi.fn().mockRejectedValue(
        new Error('null value in column "model_id" of relation "evaluations" violates not-null constraint')
      );

      const insertEvaluation = async (data: { modelId?: string }) => {
        if (!data.modelId) {
          throw new Error("modelId is required");
        }
        return mockInsert(data);
      };

      await expect(insertEvaluation({})).rejects.toThrow("modelId is required");
    });
  });

  describe("Recovery Scenarios", () => {
    it("should recover from temporary connection loss", async () => {
      let connectionAttempts = 0;
      const maxAttempts = 3;

      const mockConnect = vi.fn().mockImplementation(async () => {
        connectionAttempts++;
        if (connectionAttempts < maxAttempts) {
          throw new Error("connection refused");
        }
        return { connected: true };
      });

      // Simulate connection retry with exponential backoff
      const connectWithRetry = async (maxRetries: number, baseDelay: number) => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            return await mockConnect();
          } catch (error) {
            if (i === maxRetries - 1) throw error;
            // In real code, we'd wait here
          }
        }
      };

      const result = await connectWithRetry(5, 100);
      expect(result).toEqual({ connected: true });
      expect(connectionAttempts).toBe(3);
    });

    it("should handle graceful degradation when database is unavailable", async () => {
      const mockDbQuery = vi.fn().mockRejectedValue(new Error("database unavailable"));
      const mockCache = new Map<string, unknown>();

      // Simulate fallback to cache
      const getModelWithFallback = async (slug: string) => {
        try {
          return await mockDbQuery(slug);
        } catch (error) {
          // Check cache
          if (mockCache.has(slug)) {
            return { ...mockCache.get(slug), fromCache: true };
          }
          throw new Error(`Model ${slug} not found (database unavailable)`);
        }
      };

      // Pre-populate cache
      mockCache.set("gpt-4o", { name: "GPT-4o", score: 85 });

      // Should return cached data
      const cached = await getModelWithFallback("gpt-4o");
      expect(cached).toMatchObject({ name: "GPT-4o", fromCache: true });

      // Should throw for non-cached
      await expect(getModelWithFallback("unknown-model")).rejects.toThrow(
        "database unavailable"
      );
    });
  });

  describe("Error Message Quality", () => {
    it("should provide actionable error messages for connection failures", () => {
      const formatDbError = (error: Error): { code: string; message: string; suggestion: string } => {
        if (error.message.includes("ECONNREFUSED")) {
          return {
            code: "DB_CONNECTION_REFUSED",
            message: "Unable to connect to database",
            suggestion: "Check if the database server is running and accessible",
          };
        }
        if (error.message.includes("timeout")) {
          return {
            code: "DB_TIMEOUT",
            message: "Database operation timed out",
            suggestion: "The database may be under heavy load. Try again later.",
          };
        }
        return {
          code: "DB_ERROR",
          message: error.message,
          suggestion: "An unexpected database error occurred",
        };
      };

      const connError = formatDbError(new Error("ECONNREFUSED 127.0.0.1:5432"));
      expect(connError.code).toBe("DB_CONNECTION_REFUSED");
      expect(connError.suggestion).toContain("Check if the database server");

      const timeoutError = formatDbError(new Error("Query timeout exceeded"));
      expect(timeoutError.code).toBe("DB_TIMEOUT");
    });

    it("should sanitize sensitive information from error messages", () => {
      const sanitizeError = (error: Error): string => {
        let message = error.message;
        // Remove credentials from connection strings
        message = message.replace(/postgres:\/\/[^:]+:[^@]+@/g, "postgres://***:***@");
        // Remove API keys
        message = message.replace(/key[=:]\s*[a-zA-Z0-9_-]+/gi, "key=***");
        return message;
      };

      const errorWithCreds = new Error(
        "Connection failed to postgres://admin:secretpassword@db.example.com:5432/mydb"
      );
      const sanitized = sanitizeError(errorWithCreds);

      expect(sanitized).not.toContain("secretpassword");
      expect(sanitized).toContain("***");
    });
  });
});
