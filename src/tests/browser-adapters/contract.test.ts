/**
 * BrowserAdapter contract tests for parentbench-yec.
 *
 * Asserts that all four provider modules conform to the same shape
 * (provider name, ensureAuthenticated, newConversation, run, plus the
 * extraction/challenge-detection hooks the runner depends on).
 */

import { describe, it, expect } from "vitest";
import * as chatgpt from "@/lib/eval/browser-adapters/chatgpt";
import * as claude from "@/lib/eval/browser-adapters/claude";
import * as gemini from "@/lib/eval/browser-adapters/gemini";
import * as grok from "@/lib/eval/browser-adapters/grok";
import type { BrowserProvider } from "@/lib/eval/browser-adapters";

const adapters = [
  { name: "chatgpt" as BrowserProvider, mod: chatgpt },
  { name: "claude" as BrowserProvider, mod: claude },
  { name: "gemini" as BrowserProvider, mod: gemini },
  { name: "grok" as BrowserProvider, mod: grok },
];

describe("BrowserAdapter contract", () => {
  for (const { name, mod } of adapters) {
    describe(name, () => {
      it("should_export_an_adapter_with_matching_provider_name", () => {
        // Arrange + Act
        const adapter = mod.adapter;

        // Assert
        expect(adapter).toBeDefined();
        expect(adapter.provider).toBe(name);
      });

      it("should_implement_ensure_authenticated_as_a_function", () => {
        expect(typeof mod.adapter.ensureAuthenticated).toBe("function");
      });

      it("should_implement_new_conversation_as_a_function", () => {
        expect(typeof mod.adapter.newConversation).toBe("function");
      });

      it("should_implement_run_as_a_function", () => {
        expect(typeof mod.adapter.run).toBe("function");
      });

      it("should_export_a_pure_response_extractor", () => {
        // The pure extractor is what unit tests target — selector rot
        // gets caught here before hitting a 90-min live run.
        expect(typeof mod.extractResponse).toBe("function");
      });

      it("should_export_a_pure_challenge_detector", () => {
        expect(typeof mod.detectChallenge).toBe("function");
      });

      it("should_export_a_pure_response_complete_detector", () => {
        expect(typeof mod.detectResponseComplete).toBe("function");
      });
    });
  }
});

describe("BrowserAdapter registry", () => {
  it("should_expose_a_provider_to_adapter_map", async () => {
    // Arrange + Act
    const { browserAdapters } = await import("@/lib/eval/browser-adapters");

    // Assert
    const providers = Object.keys(browserAdapters).sort();
    expect(providers).toEqual(["chatgpt", "claude", "gemini", "grok"]);
  });

  it("should_return_an_adapter_for_each_provider_slug", async () => {
    // Arrange
    const { browserAdapters } = await import("@/lib/eval/browser-adapters");

    // Act + Assert
    for (const provider of ["chatgpt", "claude", "gemini", "grok"] as const) {
      const adapter = browserAdapters[provider];
      expect(adapter.provider).toBe(provider);
    }
  });
});
