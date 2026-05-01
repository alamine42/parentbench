#!/usr/bin/env npx tsx
/**
 * Browser-eval runner CLI (parentbench-orx).
 *
 * Drives one provider's web app through the 51 ParentBench prompts
 * via Playwright, scores results with the same scorer + LLM-judge as
 * the API track, persists evaluations/scores to Postgres with
 * surface='web-product', and triggers a paired API re-run for the
 * same model so the comparison panel stays comparable.
 *
 * Runs on the operator's machine, NOT Inngest/Vercel.
 *
 * Usage:
 *   npx tsx scripts/run-browser-eval.ts --provider chatgpt --account adult --cases all
 *   npx tsx scripts/run-browser-eval.ts --provider claude --account adult --cases sample:5
 *   npx tsx scripts/run-browser-eval.ts --provider grok --account adult --resume run-2026-04-30-grok-001
 *
 * Flags:
 *   --provider    chatgpt | claude | gemini | grok       (required)
 *   --account     account id stored in cookie store      (required, default: adult)
 *   --cases       all | sample:<N>                       (default: all)
 *   --headless    run without a visible browser          (default: false; --headless skips operator pause)
 *   --resume      <run-id> to continue a crashed run     (optional)
 *   --model       <model-slug> when the provider exposes multiple models (optional)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import {
  loadCookies,
  cookieStoreOptionsFromEnv,
  type StoredCookie,
} from "@/lib/eval/cookie-store";
import { browserAdapters, type BrowserProvider } from "@/lib/eval/browser-adapters";
import {
  runBrowserEval,
  type RunnerDeps,
} from "@/lib/eval/browser-runner/runner";
import {
  terminalOperatorPause,
  headlessOperatorPause,
} from "@/lib/eval/browser-runner/operator-pause";
import { capturePlaywrightScreenshot } from "@/lib/eval/browser-runner/screenshot";

type Args = {
  provider: BrowserProvider;
  account: string;
  cases: "all" | { sample: number };
  headless: boolean;
  resume?: string;
  modelSlug?: string;
};

function parseArgs(argv: string[]): Args {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };
  const provider = get("--provider") as BrowserProvider | undefined;
  if (
    !provider ||
    !["chatgpt", "claude", "gemini", "grok"].includes(provider)
  ) {
    throw new Error(
      "--provider must be one of: chatgpt, claude, gemini, grok"
    );
  }
  const account = get("--account") ?? "adult";
  const casesArg = get("--cases") ?? "all";
  let cases: Args["cases"];
  if (casesArg === "all") {
    cases = "all";
  } else if (casesArg.startsWith("sample:")) {
    cases = { sample: parseInt(casesArg.slice("sample:".length), 10) };
  } else {
    throw new Error("--cases must be 'all' or 'sample:<N>'");
  }
  return {
    provider,
    account,
    cases,
    headless: argv.includes("--headless"),
    resume: get("--resume"),
    modelSlug: get("--model"),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const adapter = browserAdapters[args.provider];

  const cookies: StoredCookie[] = await loadCookies(
    args.provider,
    args.account,
    cookieStoreOptionsFromEnv()
  );

  // Run dir.
  const runId =
    args.resume ?? `run-${new Date().toISOString().split("T")[0]}-${args.provider}-${Date.now()}`;
  const runDir = path.join(process.cwd(), "reports", "web", runId);
  fs.mkdirSync(runDir, { recursive: true });

  // Test cases — load from DB primary path; honor --cases sampling.
  const { db } = await import("../src/db");
  const { testCases } = await import("../src/db/schema");
  const { eq } = await import("drizzle-orm");
  const allCases = await db
    .select()
    .from(testCases)
    .where(eq(testCases.isActive, true));
  const cases =
    args.cases === "all"
      ? allCases
      : allCases.slice(0, args.cases.sample);

  // Resolve model slug if not given. Adapters share the slug used by the
  // API track for that provider's flagship — operator can override with
  // --model. Defaults are documented in the adapter modules.
  const defaultModel: Record<BrowserProvider, string> = {
    chatgpt: "gpt-5",
    claude: "claude-opus-4-7",
    gemini: "gemini-3-1-pro",
    grok: "grok-2",
  };
  const modelSlug = args.modelSlug ?? defaultModel[args.provider];

  // Page factory — Chromium persistent context with cookies pre-loaded.
  const browser = await chromium.launchPersistentContext(
    path.join(
      process.env.HOME ?? "",
      ".parentbench/profiles",
      args.provider,
      args.account
    ),
    { headless: args.headless }
  );
  await browser.addCookies(
    cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expires: c.expires,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite,
    }))
  );

  const pageFactory = async () => {
    const page = await browser.newPage();
    return {
      page,
      close: async () => {
        await page.close();
      },
    };
  };

  // Paired API re-run: send an Inngest event when the consumer run
  // finalizes. The receiving function is idempotent (won't enqueue a
  // duplicate if a recent API run exists).
  const triggerApiRerun = async (payload: {
    modelSlug: string;
    reason: string;
    consumerRunId: string;
  }) => {
    try {
      const { inngest } = await import("../src/inngest/client");
      await inngest.send({
        name: "eval/paired-api-rerun-requested",
        data: payload,
      });
    } catch (err) {
      console.warn(
        `[runner] paired API re-run trigger failed: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  };

  const deps: RunnerDeps = {
    adapter,
    pageFactory,
    captureScreenshot: capturePlaywrightScreenshot,
    operatorPause: args.headless
      ? headlessOperatorPause
      : terminalOperatorPause,
    triggerApiRerun,
    runDir,
    runId,
    provider: args.provider,
    account: args.account,
    modelSlug,
  };

  console.log(`[runner] ${args.provider}/${args.account} — ${cases.length} case(s) — runId=${runId}`);

  const { serializeTestCaseRow } = await import(
    "../src/lib/eval/adapters/index.js"
  );
  const summary = await runBrowserEval(cases.map(serializeTestCaseRow), deps);

  await browser.close();

  fs.writeFileSync(
    path.join(runDir, "summary.json"),
    JSON.stringify(summary, null, 2),
    "utf-8"
  );

  console.log(`[runner] Done. ${summary.completed}/${summary.total} ok, ${summary.infrastructureFailures} infra failures, ${(summary.durationMs / 1000).toFixed(1)}s`);
  console.log(`[runner] Run dir: ${runDir}`);
  console.log(`[runner] Next: score + insert via scripts/score-browser-eval.ts ${runId}`);
}

main().catch((err) => {
  console.error("[runner] fatal:", err);
  process.exit(1);
});
