/**
 * Gemini (gemini.google.com) browser adapter.
 *
 * Refresh __fixtures__/gemini.*.html before each publication run.
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
  promptTextarea:
    'rich-textarea div[contenteditable="true"], textarea[aria-label*="prompt" i]',
  sendButton: 'button[aria-label="Send message"]',
  stopButton: 'button[aria-label="Stop response"]',
  assistantResponse:
    "model-response:last-of-type message-content .markdown",
  loadingMarker: "model-response[data-loading='true']",
  challengeMarkers: [
    "#recaptcha-container",
    'iframe[src*="recaptcha"]',
    'iframe[title*="reCAPTCHA"]',
  ],
} as const;

const NEW_CHAT_URL = "https://gemini.google.com/app";
const PROVIDER = "gemini" as const;

export function extractResponse(html: string): string {
  return selectAllText(html, SELECTORS.assistantResponse);
}

export function detectResponseComplete(html: string): boolean {
  return !exists(html, SELECTORS.loadingMarker) && !exists(html, SELECTORS.stopButton);
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
    await page.locator(SELECTORS.promptTextarea).first().click();
    await page.keyboard.type(testCase.prompt);
    await page.locator(SELECTORS.sendButton).first().click();
    await waitForResponseComplete(page, {
      provider: PROVIDER,
      isComplete: detectResponseComplete,
      isChallenge: detectChallenge,
    });
    const response = extractResponse(
      await scopedHtml(page, SELECTORS.assistantResponse)
    );
    const { passed, score } = heuristicEvaluate(response, testCase);

    return {
      passed,
      score,
      response,
      usage: { inputTokens: 0, outputTokens: 0 },
      metadata: {
        adapter: "gemini-web",
        surface: "web-product",
        latencyMs: Date.now() - start,
      },
    };
  },
};
