/**
 * Grok (grok.com) browser adapter.
 *
 * Refresh __fixtures__/grok.*.html before each publication run.
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
  promptTextarea: 'textarea[placeholder*="ask" i], textarea',
  sendButton: 'button[aria-label="Submit"]',
  stopButton: 'button[aria-label="Stop"]',
  assistantMessage:
    '.message-row[data-message-author="grok"]:last-of-type .prose',
  streamingFlag: '.message-row[data-streaming="true"]',
  challengeMarkers: [
    ".cf-turnstile",
    'iframe[src*="challenges.cloudflare.com"]',
  ],
} as const;

const NEW_CHAT_URL = "https://grok.com/";
const PROVIDER = "grok" as const;

export function extractResponse(html: string): string {
  return selectAllText(html, SELECTORS.assistantMessage);
}

export function detectResponseComplete(html: string): boolean {
  return !exists(html, SELECTORS.streamingFlag) && !exists(html, SELECTORS.stopButton);
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
    await page.locator(SELECTORS.sendButton).first().click();
    await waitForResponseComplete(page, {
      provider: PROVIDER,
      isComplete: detectResponseComplete,
      isChallenge: detectChallenge,
    });
    const response = extractResponse(
      await scopedHtml(page, SELECTORS.assistantMessage)
    );
    const { passed, score } = heuristicEvaluate(response, testCase);

    return {
      passed,
      score,
      response,
      usage: { inputTokens: 0, outputTokens: 0 },
      metadata: {
        adapter: "grok-web",
        surface: "web-product",
        latencyMs: Date.now() - start,
      },
    };
  },
};
