/**
 * Shared mechanics for browser-adapter modules. Selectors stay
 * per-provider; this module owns parsing, the response-wait loop,
 * the auth pre-flight, and the typed challenge error.
 */

import { parse, type HTMLElement } from "node-html-parser";
import type { Page, Locator } from "playwright";

// ============================================================================
// PURE HTML HELPERS — used by per-provider extractors against fixture HTML
// ============================================================================

export function parseHtml(html: string): HTMLElement {
  return parse(html, { comment: false });
}

export function selectAllText(html: string, selector: string): string {
  const root = parseHtml(html);
  return root
    .querySelectorAll(selector)
    .map((n) => n.text.trim())
    .filter(Boolean)
    .join("\n")
    .replace(/[ \t]+/g, " ");
}

export function exists(html: string, selector: string): boolean {
  return parseHtml(html).querySelector(selector) !== null;
}

export function existsAny(html: string, selectors: string[]): boolean {
  const root = parseHtml(html);
  return selectors.some((s) => root.querySelector(s) !== null);
}

// ============================================================================
// CHALLENGE ERROR — typed so the runner's retry loop can match by class,
// not by substring on the message. String-grepping breaks silently if any
// adapter rewords its error.
// ============================================================================

export class ChallengeError extends Error {
  readonly provider: string;
  constructor(provider: string, context: string) {
    super(`${provider} challenge intercept (${context})`);
    this.name = "ChallengeError";
    this.provider = provider;
  }
}

// ============================================================================
// ADAPTER MECHANICS — shared across the 4 provider modules
// ============================================================================

const POLL_INTERVAL_MS = 500;
const RESPONSE_TIMEOUT_MS = 90_000;

export type AdapterSelectors = {
  promptTextarea: string;
  /** Selector for the latest assistant turn's text region. */
  assistantTurn: string;
  /** Selectors that, if present, indicate a Cloudflare/captcha challenge. */
  challengeMarkers: string[];
};

export type WaitForResponseOptions = {
  provider: string;
  isComplete: (html: string) => boolean;
  isChallenge: (html: string) => boolean;
  timeoutMs?: number;
  pollMs?: number;
};

/**
 * Poll the page until either the response completes or a challenge
 * appears. Throws ChallengeError on intercept (so the runner can pause
 * for the operator) or a plain Error on timeout.
 */
export async function waitForResponseComplete(
  page: Page,
  options: WaitForResponseOptions
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? RESPONSE_TIMEOUT_MS;
  const pollMs = options.pollMs ?? POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const html = await page.content();
    if (options.isChallenge(html)) {
      throw new ChallengeError(options.provider, "during response wait");
    }
    if (options.isComplete(html)) return;
    await page.waitForTimeout(pollMs);
  }
  throw new Error(`${options.provider} response wait timed out`);
}

/** Pull the outerHTML of a scoped region (falls back to full page). */
export async function scopedHtml(page: Page, selector: string): Promise<string> {
  const locator: Locator = page.locator(selector).last();
  if ((await locator.count()) === 0) return await page.content();
  return await locator.evaluate((el) => el.outerHTML);
}

/**
 * Verify the operator's cookies authenticate against the provider.
 * Throws ChallengeError if the request was intercepted, plain Error
 * if the composer never appears (cookies expired or invalid).
 */
export async function assertAuthenticated(
  page: Page,
  options: {
    provider: string;
    url: string;
    promptSelector: string;
    isChallenge: (html: string) => boolean;
  }
): Promise<void> {
  await page.goto(options.url, { waitUntil: "domcontentloaded" });
  const html = await page.content();
  if (options.isChallenge(html)) {
    throw new ChallengeError(options.provider, "during auth check");
  }
  const composer = page.locator(options.promptSelector).first();
  if ((await composer.count()) === 0) {
    throw new Error(
      `${options.provider} not authenticated: composer not found`
    );
  }
}

/** Open a fresh chat. Called between every test case to prevent context bleed. */
export async function openNewConversation(
  page: Page,
  options: { url: string; promptSelector: string }
): Promise<void> {
  await page.goto(options.url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(options.promptSelector, { timeout: 30_000 });
}
