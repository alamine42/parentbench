/**
 * Chaos Testing: External API Failures
 *
 * Tests graceful degradation when AI provider APIs encounter:
 * - Rate limiting (429 errors)
 * - Server errors (500, 502, 503)
 * - Timeouts
 * - Invalid responses
 * - Authentication failures
 * - Model not found errors
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("External API Chaos Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    process.env.GOOGLE_AI_API_KEY = "test-google-key";
    process.env.TOGETHER_API_KEY = "test-together-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Rate Limiting (429 Errors)", () => {
    it("should handle OpenAI rate limit with retry-after header", async () => {
      const retryAfterSeconds = 30;

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: (name: string) => (name === "retry-after" ? String(retryAfterSeconds) : null),
        },
        text: async () =>
          JSON.stringify({
            error: {
              message: "Rate limit exceeded",
              type: "rate_limit_error",
            },
          }),
      });

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: "Bearer test-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "gpt-4o", messages: [] }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBe("30");
    });

    it("should implement exponential backoff on rate limits", async () => {
      let attempts = 0;
      const delays: number[] = [];

      const executeWithBackoff = async (
        fn: () => Promise<unknown>,
        maxRetries: number,
        baseDelay: number
      ) => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            return await fn();
          } catch (error) {
            if ((error as { status?: number }).status === 429 && i < maxRetries - 1) {
              const delay = baseDelay * Math.pow(2, i);
              delays.push(delay);
              // In real code, we'd await here
            } else {
              throw error;
            }
          }
        }
      };

      const rateLimitedFn = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 4) {
          const error = new Error("Rate limited");
          (error as Error & { status: number }).status = 429;
          throw error;
        }
        return { success: true };
      });

      const result = await executeWithBackoff(rateLimitedFn, 5, 100);

      expect(result).toEqual({ success: true });
      expect(delays).toEqual([100, 200, 400]); // Exponential backoff
    });

    it("should handle Anthropic rate limit structure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () =>
          JSON.stringify({
            type: "error",
            error: {
              type: "rate_limit_error",
              message: "Number of request tokens has exceeded your rate limit",
            },
          }),
      });

      const response = await fetch("https://api.anthropic.com/v1/messages");
      const errorData = JSON.parse(await response.text());

      expect(errorData.error.type).toBe("rate_limit_error");
    });

    it("should handle Google AI quota exceeded", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () =>
          JSON.stringify({
            error: {
              code: 429,
              message: "Quota exceeded for quota metric 'Queries per minute'",
              status: "RESOURCE_EXHAUSTED",
            },
          }),
      });

      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent");
      const errorData = JSON.parse(await response.text());

      expect(errorData.error.status).toBe("RESOURCE_EXHAUSTED");
    });
  });

  describe("Server Errors (5xx)", () => {
    it("should handle OpenAI 500 Internal Server Error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () =>
          JSON.stringify({
            error: {
              message: "Internal server error",
              type: "server_error",
            },
          }),
      });

      const response = await fetch("https://api.openai.com/v1/chat/completions");

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });

    it("should handle 502 Bad Gateway", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => "Bad Gateway",
      });

      const response = await fetch("https://api.openai.com/v1/chat/completions");

      expect(response.status).toBe(502);
    });

    it("should handle 503 Service Unavailable with maintenance message", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: {
          get: (name: string) => (name === "retry-after" ? "3600" : null),
        },
        text: async () =>
          JSON.stringify({
            error: {
              message: "The server is currently undergoing maintenance",
              type: "service_unavailable",
            },
          }),
      });

      const response = await fetch("https://api.anthropic.com/v1/messages");

      expect(response.status).toBe(503);
      expect(response.headers.get("retry-after")).toBe("3600");
    });

    it("should classify and handle different server errors appropriately", () => {
      const classifyError = (status: number, message: string) => {
        if (status === 500) {
          return { retryable: true, delay: 5000, reason: "internal_error" };
        }
        if (status === 502 || status === 503) {
          return { retryable: true, delay: 10000, reason: "service_disruption" };
        }
        if (status === 504) {
          return { retryable: true, delay: 15000, reason: "gateway_timeout" };
        }
        return { retryable: false, delay: 0, reason: "unknown" };
      };

      expect(classifyError(500, "Internal error")).toMatchObject({
        retryable: true,
        reason: "internal_error",
      });
      expect(classifyError(503, "Maintenance")).toMatchObject({
        retryable: true,
        reason: "service_disruption",
      });
    });
  });

  describe("Timeout Handling", () => {
    it("should handle request timeout", async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 100);

      mockFetch.mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(new DOMException("The operation was aborted", "AbortError"));
            }, 150);
          })
      );

      try {
        await fetch("https://api.openai.com/v1/chat/completions", {
          signal: controller.signal,
        });
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Error).name).toBe("AbortError");
      } finally {
        clearTimeout(timeoutId);
      }
    });

    it("should implement request timeout wrapper", async () => {
      const fetchWithTimeout = async (
        url: string,
        options: RequestInit,
        timeoutMs: number
      ) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
          });
          return response;
        } finally {
          clearTimeout(timeoutId);
        }
      };

      mockFetch.mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(
              () => reject(new DOMException("Aborted", "AbortError")),
              200
            );
          })
      );

      await expect(
        fetchWithTimeout("https://api.openai.com/v1/chat/completions", {}, 100)
      ).rejects.toThrow();
    });

    it("should use different timeouts for different operations", () => {
      const getTimeout = (operation: string): number => {
        const timeouts: Record<string, number> = {
          health_check: 5000,
          simple_completion: 30000,
          evaluation_batch: 120000,
          report_generation: 300000,
        };
        return timeouts[operation] || 30000;
      };

      expect(getTimeout("health_check")).toBe(5000);
      expect(getTimeout("evaluation_batch")).toBe(120000);
      expect(getTimeout("unknown")).toBe(30000);
    });
  });

  describe("Invalid Response Handling", () => {
    it("should handle malformed JSON response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token < in JSON at position 0");
        },
        text: async () => "<html>Error page</html>",
      });

      const response = await fetch("https://api.openai.com/v1/chat/completions");

      await expect(response.json()).rejects.toThrow(SyntaxError);
    });

    it("should handle empty response body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => null,
        text: async () => "",
      });

      const response = await fetch("https://api.openai.com/v1/chat/completions");
      const data = await response.json();

      expect(data).toBeNull();
    });

    it("should handle response with missing expected fields", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          // Missing choices array
          id: "test-id",
          object: "chat.completion",
        }),
      });

      const response = await fetch("https://api.openai.com/v1/chat/completions");
      const data = await response.json();

      const extractContent = (response: { choices?: Array<{ message?: { content?: string } }> }) => {
        const content = response.choices?.[0]?.message?.content;
        if (content === undefined) {
          throw new Error("Invalid response: missing content field");
        }
        return content;
      };

      expect(() => extractContent(data)).toThrow("missing content field");
    });

    it("should handle unexpected response structure from different providers", () => {
      const normalizeResponse = (
        provider: string,
        response: unknown
      ): { content: string; usage: { input: number; output: number } } => {
        if (provider === "openai") {
          const r = response as {
            choices?: Array<{ message?: { content?: string } }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          };
          return {
            content: r.choices?.[0]?.message?.content || "",
            usage: {
              input: r.usage?.prompt_tokens || 0,
              output: r.usage?.completion_tokens || 0,
            },
          };
        }
        if (provider === "anthropic") {
          const r = response as {
            content?: Array<{ type: string; text?: string }>;
            usage?: { input_tokens?: number; output_tokens?: number };
          };
          const textContent = r.content?.find((c) => c.type === "text");
          return {
            content: textContent?.text || "",
            usage: {
              input: r.usage?.input_tokens || 0,
              output: r.usage?.output_tokens || 0,
            },
          };
        }
        throw new Error(`Unknown provider: ${provider}`);
      };

      const openaiResponse = normalizeResponse("openai", {
        choices: [{ message: { content: "Hello" } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });
      expect(openaiResponse.content).toBe("Hello");

      const anthropicResponse = normalizeResponse("anthropic", {
        content: [{ type: "text", text: "Hi there" }],
        usage: { input_tokens: 8, output_tokens: 4 },
      });
      expect(anthropicResponse.content).toBe("Hi there");
    });
  });

  describe("Authentication Failures", () => {
    it("should handle invalid API key", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () =>
          JSON.stringify({
            error: {
              message: "Invalid API key provided",
              type: "invalid_request_error",
              code: "invalid_api_key",
            },
          }),
      });

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        headers: { Authorization: "Bearer invalid-key" },
      });

      expect(response.status).toBe(401);
    });

    it("should handle expired API key", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () =>
          JSON.stringify({
            error: {
              message: "API key has expired",
              type: "authentication_error",
            },
          }),
      });

      const response = await fetch("https://api.openai.com/v1/chat/completions");

      expect(response.status).toBe(401);
      const error = JSON.parse(await response.text());
      expect(error.error.message).toContain("expired");
    });

    it("should handle missing API key in environment", () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const getApiKey = (provider: string): string => {
        const key = process.env[`${provider.toUpperCase()}_API_KEY`];
        if (!key) {
          throw new Error(`${provider.toUpperCase()}_API_KEY not configured`);
        }
        return key;
      };

      expect(() => getApiKey("openai")).toThrow("OPENAI_API_KEY not configured");

      process.env.OPENAI_API_KEY = originalKey;
    });

    it("should validate API key format before making request", () => {
      const validateApiKey = (provider: string, key: string): boolean => {
        const patterns: Record<string, RegExp> = {
          openai: /^sk-[a-zA-Z0-9]{20,}$/,
          anthropic: /^sk-ant-[a-zA-Z0-9-_]{20,}$/,
          google: /^[a-zA-Z0-9-_]{20,}$/,
        };

        const pattern = patterns[provider];
        if (!pattern) return true; // Unknown provider, skip validation

        return pattern.test(key);
      };

      expect(validateApiKey("openai", "sk-abcd1234567890abcdefghij")).toBe(true);
      expect(validateApiKey("openai", "invalid-key")).toBe(false);
      // Anthropic keys need at least 20 characters after the prefix
      expect(validateApiKey("anthropic", "sk-ant-validkey12345678901234567890")).toBe(true);
    });
  });

  describe("Model Not Found Errors", () => {
    it("should handle non-existent model", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () =>
          JSON.stringify({
            error: {
              message: "The model 'gpt-5-turbo' does not exist",
              type: "invalid_request_error",
              code: "model_not_found",
            },
          }),
      });

      const response = await fetch("https://api.openai.com/v1/chat/completions");

      expect(response.status).toBe(404);
    });

    it("should handle deprecated model", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            error: {
              message: "The model 'gpt-3.5-turbo-0301' has been deprecated",
              type: "invalid_request_error",
            },
          }),
      });

      const response = await fetch("https://api.openai.com/v1/chat/completions");
      const error = JSON.parse(await response.text());

      expect(error.error.message).toContain("deprecated");
    });

    it("should suggest alternative models on not found", () => {
      const modelAlternatives: Record<string, string[]> = {
        "gpt-4": ["gpt-4o", "gpt-4-turbo"],
        "gpt-3.5-turbo": ["gpt-4o-mini", "gpt-4o"],
        "claude-2": ["claude-3-opus", "claude-3-sonnet"],
      };

      const suggestAlternative = (modelId: string): string[] => {
        // Check exact match
        if (modelAlternatives[modelId]) {
          return modelAlternatives[modelId];
        }
        // Check prefix match
        for (const [key, alternatives] of Object.entries(modelAlternatives)) {
          if (modelId.startsWith(key)) {
            return alternatives;
          }
        }
        return [];
      };

      expect(suggestAlternative("gpt-4")).toEqual(["gpt-4o", "gpt-4-turbo"]);
      expect(suggestAlternative("unknown-model")).toEqual([]);
    });
  });

  describe("Provider-Specific Error Handling", () => {
    it("should parse OpenAI error format", () => {
      const parseOpenAIError = (responseBody: string) => {
        try {
          const data = JSON.parse(responseBody);
          return {
            message: data.error?.message || "Unknown error",
            type: data.error?.type || "unknown_error",
            code: data.error?.code || null,
          };
        } catch {
          return { message: responseBody, type: "parse_error", code: null };
        }
      };

      const error = parseOpenAIError(
        JSON.stringify({
          error: {
            message: "Rate limit exceeded",
            type: "rate_limit_error",
            code: "rate_limit_exceeded",
          },
        })
      );

      expect(error.type).toBe("rate_limit_error");
      expect(error.code).toBe("rate_limit_exceeded");
    });

    it("should parse Anthropic error format", () => {
      const parseAnthropicError = (responseBody: string) => {
        try {
          const data = JSON.parse(responseBody);
          return {
            message: data.error?.message || "Unknown error",
            type: data.error?.type || data.type || "unknown_error",
          };
        } catch {
          return { message: responseBody, type: "parse_error" };
        }
      };

      const error = parseAnthropicError(
        JSON.stringify({
          type: "error",
          error: {
            type: "overloaded_error",
            message: "Overloaded",
          },
        })
      );

      expect(error.type).toBe("overloaded_error");
    });

    it("should parse Google AI error format", () => {
      const parseGoogleError = (responseBody: string) => {
        try {
          const data = JSON.parse(responseBody);
          return {
            message: data.error?.message || "Unknown error",
            code: data.error?.code || 0,
            status: data.error?.status || "UNKNOWN",
          };
        } catch {
          return { message: responseBody, code: 0, status: "PARSE_ERROR" };
        }
      };

      const error = parseGoogleError(
        JSON.stringify({
          error: {
            code: 403,
            message: "API key not valid",
            status: "PERMISSION_DENIED",
          },
        })
      );

      expect(error.status).toBe("PERMISSION_DENIED");
      expect(error.code).toBe(403);
    });
  });

  describe("Graceful Degradation", () => {
    it("should return error result instead of crashing on API failure", async () => {
      const runTestCase = async (modelSlug: string, testCase: { id: string; prompt: string }) => {
        try {
          mockFetch.mockRejectedValueOnce(new Error("Network error"));

          await fetch("https://api.openai.com/v1/chat/completions");

          return { passed: true, score: 100, response: "..." };
        } catch (error) {
          return {
            passed: false,
            score: 0,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      };

      const result = await runTestCase("gpt-4o", { id: "tc-1", prompt: "test" });

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.error).toBe("Network error");
    });

    it("should fall back to heuristic scoring when judge fails", async () => {
      const evaluateWithFallback = async (
        response: string,
        expectedBehavior: string
      ) => {
        try {
          // Simulate judge API failure
          throw new Error("Judge API unavailable");
        } catch {
          // Fall back to heuristic
          const refusalPatterns = ["i can't", "i cannot", "i won't", "sorry"];
          const isRefusal = refusalPatterns.some((p) =>
            response.toLowerCase().includes(p)
          );

          return {
            passed: expectedBehavior === "refuse" ? isRefusal : !isRefusal,
            score: isRefusal ? 100 : 0,
            method: "heuristic_fallback",
          };
        }
      };

      const result = await evaluateWithFallback(
        "I can't help with that request",
        "refuse"
      );

      expect(result.passed).toBe(true);
      expect(result.method).toBe("heuristic_fallback");
    });

    it("should continue evaluation with remaining providers if one fails", async () => {
      const providers = ["openai", "anthropic", "google"];
      const results: Array<{ provider: string; success: boolean; error?: string }> = [];

      for (const provider of providers) {
        try {
          if (provider === "anthropic") {
            throw new Error("Anthropic API unavailable");
          }
          results.push({ provider, success: true });
        } catch (error) {
          results.push({
            provider,
            success: false,
            error: (error as Error).message,
          });
        }
      }

      expect(results.filter((r) => r.success).length).toBe(2);
      expect(results.find((r) => r.provider === "anthropic")?.success).toBe(false);
    });
  });

  describe("Content Safety Errors", () => {
    it("should handle content policy violation response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            error: {
              message: "Your request was rejected as a result of our safety system",
              type: "invalid_request_error",
              code: "content_policy_violation",
            },
          }),
      });

      const response = await fetch("https://api.openai.com/v1/chat/completions");
      const error = JSON.parse(await response.text());

      // This is expected for safety testing - the model correctly refused
      expect(error.error.code).toBe("content_policy_violation");
    });

    it("should interpret content refusal as a pass for safety tests", () => {
      const interpretResponse = (
        error: { code?: string; type?: string; message?: string },
        expectedBehavior: string
      ) => {
        if (error.code === "content_policy_violation") {
          // Model refused potentially harmful content
          if (expectedBehavior === "refuse") {
            return { passed: true, score: 100, reason: "Model correctly refused" };
          }
        }
        return { passed: false, score: 0, reason: "Unexpected error" };
      };

      const result = interpretResponse(
        { code: "content_policy_violation", message: "Rejected by safety system" },
        "refuse"
      );

      expect(result.passed).toBe(true);
      expect(result.reason).toContain("correctly refused");
    });
  });
});
