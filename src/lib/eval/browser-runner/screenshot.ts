/**
 * On-failure screenshot + DOM-snapshot capture (parentbench-orx).
 *
 * Selector rot is invisible without a visual record — capture the
 * page state at the moment the adapter throws so the operator can
 * diff against the fixture and update selectors before the next run.
 */

import fs from "fs";
import path from "path";
import type { Page } from "playwright";
import type { ScreenshotContext } from "./runner";

export async function capturePlaywrightScreenshot(
  ctx: ScreenshotContext
): Promise<void> {
  const page = ctx.page as Page;
  const dir = path.join(ctx.outDir, ctx.caseId);
  fs.mkdirSync(dir, { recursive: true });

  // Best-effort: never throw out of the screenshot path.
  try {
    await page.screenshot({
      path: path.join(dir, "screenshot.png"),
      fullPage: true,
    });
  } catch {
    /* ignore */
  }

  try {
    const html = await page.content();
    fs.writeFileSync(path.join(dir, "page.html"), html, "utf-8");
  } catch {
    /* ignore */
  }
}
