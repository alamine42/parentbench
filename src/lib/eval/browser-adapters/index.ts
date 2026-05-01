/**
 * Browser-driven evaluation adapters for the consumer-products track
 * (parentbench-d95). These wrap Playwright `Page` interactions with
 * each provider's web app — the same shape as the API-track
 * `ModelAdapter`, just sourcing model responses through a real
 * authenticated session instead of a JSON endpoint.
 *
 * Per-provider modules own their selectors, "is response complete?"
 * detection, and challenge-DOM detection. Those three things are
 * exposed as PURE functions (`extractResponse`, `detectResponseComplete`,
 * `detectChallenge`) so unit tests can exercise them against fixture
 * HTML without spinning up a browser.
 *
 * NOTE: Selectors in each provider module are HAND-WRITTEN best
 * guesses — they MUST be confirmed against the live site by an
 * operator before each publication run, with the corresponding
 * fixture refreshed. Selector rot is the primary failure mode.
 */

import type { Page } from "playwright";
import type {
  AdapterResult,
  SerializedTestCase,
} from "@/lib/eval/adapters";

import { adapter as chatgptAdapter } from "./chatgpt";
import { adapter as claudeAdapter } from "./claude";
import { adapter as geminiAdapter } from "./gemini";
import { adapter as grokAdapter } from "./grok";

export type BrowserProvider = "chatgpt" | "claude" | "gemini" | "grok";

export interface BrowserAdapter {
  readonly provider: BrowserProvider;

  /** Verify cookies authenticate. Throws on failure. */
  ensureAuthenticated(page: Page): Promise<void>;

  /** Open a fresh chat. Called between every test case. */
  newConversation(page: Page): Promise<void>;

  /**
   * Submit a prompt and extract the response. Throws on infrastructure
   * failure (timeout, challenge mid-stream, network error). Refusals
   * and policy intercepts come back as a normal AdapterResult so the
   * shared scorer/judge can grade them.
   */
  run(page: Page, testCase: SerializedTestCase): Promise<AdapterResult>;
}

export const browserAdapters: Record<BrowserProvider, BrowserAdapter> = {
  chatgpt: chatgptAdapter,
  claude: claudeAdapter,
  gemini: geminiAdapter,
  grok: grokAdapter,
};

export function getBrowserAdapter(provider: BrowserProvider): BrowserAdapter {
  return browserAdapters[provider];
}
