#!/usr/bin/env npx tsx
/**
 * Cookie refresh script for the consumer-products track (parentbench-0i0).
 *
 * Opens a real browser at the provider's login URL. Operator signs in
 * by hand. When ready, presses Enter in the terminal — the script
 * captures the resulting cookies and stores them via the secure
 * cookie-store API (keychain by default; encrypted-file fallback when
 * PARENTBENCH_COOKIE_TIER=encrypted-file).
 *
 * Usage:
 *   npx tsx scripts/refresh-browser-cookies.ts <provider> [<account>]
 *
 *   provider: chatgpt | claude | gemini | grok
 *   account:  identifier for this session (default: adult)
 *
 * Env vars:
 *   PARENTBENCH_COOKIE_TIER         keychain | encrypted-file (default: keychain)
 *   PARENTBENCH_COOKIE_PASSPHRASE   required when tier is encrypted-file
 *   PARENTBENCH_COOKIE_DIR          directory for encrypted files (default: ~/.parentbench/cookies)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import readline from "readline";
import { chromium } from "playwright";
import {
  saveCookies,
  listExpiring,
  cookieStoreOptionsFromEnv,
  type StoredCookie,
} from "@/lib/eval/cookie-store";

const LOGIN_URLS: Record<string, string> = {
  chatgpt: "https://chatgpt.com/auth/login",
  claude: "https://claude.ai/login",
  gemini: "https://accounts.google.com/signin/v2/identifier?service=gemini",
  grok: "https://grok.com/login",
};

async function waitForEnter(prompt: string): Promise<void> {
  process.stdout.write(`\n${prompt}\n> `);
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.once("line", () => {
      rl.close();
      resolve();
    });
  });
}

async function main() {
  const provider = process.argv[2];
  const account = process.argv[3] ?? "adult";
  if (!provider || !LOGIN_URLS[provider]) {
    console.error(
      `Usage: npx tsx scripts/refresh-browser-cookies.ts <provider> [<account>]\n` +
        `  provider: ${Object.keys(LOGIN_URLS).join(" | ")}`
    );
    process.exit(1);
  }

  const options = cookieStoreOptionsFromEnv();
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`[refresh] Opening ${provider} login...`);
  await page.goto(LOGIN_URLS[provider]);

  await waitForEnter(
    `Sign in to ${provider} as the '${account}' account in the open browser. ` +
      `When you're fully signed in (chat composer visible), press Enter to capture cookies.`
  );

  const captured = await context.cookies();
  const cookies: StoredCookie[] = captured.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    expires: c.expires,
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite: c.sameSite,
  }));

  await saveCookies(provider, account, cookies, options);

  const expiring = listExpiring(cookies, 7);
  if (expiring.length > 0) {
    console.warn(
      `[refresh] WARNING: ${expiring.length} cookie(s) expire within 7 days:`
    );
    for (const c of expiring) {
      const daysLeft = Math.round(
        (c.expires - Math.floor(Date.now() / 1000)) / 86400
      );
      console.warn(`  - ${c.name} (${c.domain}) — ${daysLeft}d`);
    }
  }

  console.log(
    `[refresh] Saved ${cookies.length} cookie(s) for ${provider}/${account} via ${options.tier}.`
  );
  await browser.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("[refresh] fatal:", err);
  process.exit(1);
});
