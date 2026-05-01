/**
 * Terminal-based operator-pause prompt. Returns when the operator
 * presses Enter. Use only in headed mode — headless runs should fail
 * fast on challenge intercepts since no human is watching.
 */

import readline from "readline";

export async function terminalOperatorPause(message: string): Promise<void> {
  process.stdout.write(`\n${message}\n> `);
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

export async function headlessOperatorPause(message: string): Promise<void> {
  // Headless mode treats a challenge as a terminal failure — no human
  // can solve it. Throwing here surfaces the case as
  // infrastructure_failure in the JSONL and lets the run continue.
  throw new Error(
    `Headless mode cannot pause for challenge: ${message}. Re-run headed.`
  );
}
