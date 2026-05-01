/**
 * ChatGPT (chatgpt.com) browser adapter.
 *
 * Selectors below are best-effort against the live site as of
 * 2026-04-30. They MUST be re-verified before each publication run by
 * refreshing src/lib/eval/browser-adapters/__fixtures__/chatgpt.*.html
 * from a real session and re-running the extraction tests.
 */

import type { Page } from "playwright";
import {
  heuristicEvaluate,
  type AdapterResult,
  type SerializedTestCase,
} from "@/lib/eval/adapters";
import type { BrowserAdapter } from "./index";
import {
  exists,
  existsAny,
  selectAllText,
  assertAuthenticated,
  openNewConversation,
  scopedHtml,
  waitForResponseComplete,
} from "./_dom";

const SELECTORS = {
  promptTextarea: '[data-testid="prompt-textarea"], textarea[placeholder]',
  sendButton: '[data-testid="send-button"]',
  stopButton: '[data-testid="stop-button"]',
  assistantTurn:
    '[data-message-author-role="assistant"]:last-of-type .markdown',
  streamingClass: ".result-streaming",
  challengeMarkers: [
    "#challenge-stage",
    ".cf-turnstile",
    'iframe[src*="challenges.cloudflare.com"]',
  ],
} as const;

const NEW_CHAT_URL = "https://chatgpt.com/";
const PROVIDER = "chatgpt" as const;

export function extractResponse(html: string): string {
  return selectAllText(html, SELECTORS.assistantTurn);
}

export function detectResponseComplete(html: string): boolean {
  return !exists(html, SELECTORS.streamingClass) && !exists(html, SELECTORS.stopButton);
}

export function detectChallenge(html: string): boolean {
  return existsAny(html, [...SELECTORS.challengeMarkers]);
}

export const adapter: BrowserAdapter = {
  provider: PROVIDER,

  ensureAuthenticated: (page: Page) =>
    assertAuthenticated(page, {
      provider: PROVIDER,
      url: NEW_CHAT_URL,
      promptSelector: SELECTORS.promptTextarea,
      isChallenge: detectChallenge,
    }),

  newConversation: (page: Page) =>
    openNewConversation(page, {
      url: NEW_CHAT_URL,
      promptSelector: SELECTORS.promptTextarea,
    }),

  async run(
    page: Page,
    testCase: SerializedTestCase
  ): Promise<AdapterResult> {
    const start = Date.now();
    await page.locator(SELECTORS.promptTextarea).first().fill(testCase.prompt);
    await page.locator(SELECTORS.sendButton).click();
    await waitForResponseComplete(page, {
      provider: PROVIDER,
      isComplete: detectResponseComplete,
      isChallenge: detectChallenge,
    });
    const response = extractResponse(
      await scopedHtml(page, SELECTORS.assistantTurn)
    );
    const { passed, score } = heuristicEvaluate(response, testCase);

    return {
      passed,
      score,
      response,
      usage: { inputTokens: 0, outputTokens: 0 },
      metadata: {
        adapter: "chatgpt-web",
        surface: "web-product",
        latencyMs: Date.now() - start,
      },
    };
  },
};
