/**
 * Per-provider extraction tests for parentbench-yec.
 *
 * Tests run against canonical "after-prompt" / "streaming" / "challenge"
 * fixture HTML — no live browser. Selector rot is caught when fixtures
 * are refreshed, not 60 minutes into a real publication run.
 *
 * Fixtures live at src/lib/eval/browser-adapters/__fixtures__/.
 */

import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import * as chatgpt from "@/lib/eval/browser-adapters/chatgpt";
import * as claude from "@/lib/eval/browser-adapters/claude";
import * as gemini from "@/lib/eval/browser-adapters/gemini";
import * as grok from "@/lib/eval/browser-adapters/grok";

const FIX_DIR = path.join(
  __dirname,
  "..",
  "..",
  "lib",
  "eval",
  "browser-adapters",
  "__fixtures__"
);

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(FIX_DIR, name), "utf-8");
}

describe("ChatGPT extraction", () => {
  it("should_extract_assistant_response_text_from_after_prompt_dom", () => {
    // Arrange
    const html = loadFixture("chatgpt.after-prompt.html");

    // Act
    const text = chatgpt.extractResponse(html);

    // Assert
    expect(text).toContain("capital of France is");
    expect(text).toContain("Paris");
    expect(text).toContain("more details");
  });

  it("should_report_response_complete_when_streaming_class_is_absent", () => {
    // Arrange
    const html = loadFixture("chatgpt.after-prompt.html");

    // Act
    const complete = chatgpt.detectResponseComplete(html);

    // Assert
    expect(complete).toBe(true);
  });

  it("should_report_response_incomplete_while_streaming", () => {
    // Arrange
    const html = loadFixture("chatgpt.streaming.html");

    // Act
    const complete = chatgpt.detectResponseComplete(html);

    // Assert
    expect(complete).toBe(false);
  });

  it("should_detect_cloudflare_turnstile_challenge", () => {
    // Arrange
    const html = loadFixture("chatgpt.challenge.html");

    // Act
    const challenge = chatgpt.detectChallenge(html);

    // Assert
    expect(challenge).toBe(true);
  });

  it("should_not_flag_a_normal_response_as_a_challenge", () => {
    // Arrange
    const html = loadFixture("chatgpt.after-prompt.html");

    // Act
    const challenge = chatgpt.detectChallenge(html);

    // Assert
    expect(challenge).toBe(false);
  });
});

describe("Claude extraction", () => {
  it("should_extract_assistant_response_from_font_claude_message", () => {
    // Arrange
    const html = loadFixture("claude.after-prompt.html");

    // Act
    const text = claude.extractResponse(html);

    // Assert
    expect(text).toContain("Paris");
    expect(text).toContain("largest city");
  });

  it("should_report_response_complete_when_data_streaming_is_false", () => {
    expect(
      claude.detectResponseComplete(loadFixture("claude.after-prompt.html"))
    ).toBe(true);
  });

  it("should_report_response_incomplete_when_data_streaming_is_true", () => {
    expect(
      claude.detectResponseComplete(loadFixture("claude.streaming.html"))
    ).toBe(false);
  });

  it("should_detect_cloudflare_challenge_iframe", () => {
    expect(
      claude.detectChallenge(loadFixture("claude.challenge.html"))
    ).toBe(true);
  });

  it("should_not_flag_a_normal_response_as_a_challenge", () => {
    expect(
      claude.detectChallenge(loadFixture("claude.after-prompt.html"))
    ).toBe(false);
  });
});

describe("Gemini extraction", () => {
  it("should_extract_assistant_response_from_model_response_element", () => {
    const text = gemini.extractResponse(loadFixture("gemini.after-prompt.html"));
    expect(text).toContain("Paris");
  });

  it("should_report_response_complete_when_data_loading_is_absent", () => {
    expect(
      gemini.detectResponseComplete(loadFixture("gemini.after-prompt.html"))
    ).toBe(true);
  });

  it("should_report_response_incomplete_when_data_loading_is_true", () => {
    expect(
      gemini.detectResponseComplete(loadFixture("gemini.streaming.html"))
    ).toBe(false);
  });

  it("should_detect_recaptcha_challenge", () => {
    expect(
      gemini.detectChallenge(loadFixture("gemini.challenge.html"))
    ).toBe(true);
  });

  it("should_not_flag_a_normal_response_as_a_challenge", () => {
    expect(
      gemini.detectChallenge(loadFixture("gemini.after-prompt.html"))
    ).toBe(false);
  });
});

describe("Grok extraction", () => {
  it("should_extract_assistant_response_from_message_bubble", () => {
    const text = grok.extractResponse(loadFixture("grok.after-prompt.html"));
    expect(text).toContain("Paris");
  });

  it("should_report_response_complete_when_data_streaming_is_absent", () => {
    expect(
      grok.detectResponseComplete(loadFixture("grok.after-prompt.html"))
    ).toBe(true);
  });

  it("should_report_response_incomplete_when_data_streaming_is_true", () => {
    expect(
      grok.detectResponseComplete(loadFixture("grok.streaming.html"))
    ).toBe(false);
  });

  it("should_detect_cloudflare_turnstile_challenge", () => {
    expect(
      grok.detectChallenge(loadFixture("grok.challenge.html"))
    ).toBe(true);
  });

  it("should_not_flag_a_normal_response_as_a_challenge", () => {
    expect(
      grok.detectChallenge(loadFixture("grok.after-prompt.html"))
    ).toBe(false);
  });
});
