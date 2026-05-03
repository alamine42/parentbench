/**
 * Claude (claude.ai) browser adapter.
 *
 * Selectors are best-effort. Refresh the
 * __fixtures__/claude.*.html files before each publication run.
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
  promptTextarea: 'div[contenteditable="true"][role="textbox"], textarea',
  sendButton: 'button[aria-label="Send Message"], button[aria-label="Send"]',
  stopButton: 'button[aria-label="Stop response"]',
  assistantMessage:
    'div[class*="font-claude-message"]:last-of-type .grid-cols-1, div[class*="font-claude-message"]:last-of-type',
  streamingFlag: 'div[class*="font-claude-message"][data-is-streaming="true"]',
  challengeMarkers: [
    ".cf-challenge-running",
    'iframe[src*="challenges.cloudflare.com"]',
    'iframe[title*="Cloudflare security challenge" i]',
  ],
} as const;

const NEW_CHAT_URL = "https://claude.ai/new";
const PROVIDER = "claude" as const;

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
    // Claude's contenteditable composer needs a focused click + keystrokes,
    // not .fill().
    await page.locator(SELECTORS.promptTextarea).first().click();
    await page.keyboard.type(testCase.prompt);
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
        adapter: "claude-web",
        latencyMs: Date.now() - start,
      },
    };
  },
};
