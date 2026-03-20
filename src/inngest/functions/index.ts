/**
 * Inngest Function Registry
 *
 * All Inngest functions must be exported here and passed to the serve() handler.
 */

import { runEvaluation } from "./run-evaluation";
import { sendAlerts } from "./send-alerts";

// Export all functions for the serve() handler
export const functions = [
  runEvaluation,
  sendAlerts,
];

// Named exports for direct imports
export { runEvaluation } from "./run-evaluation";
export { sendAlerts } from "./send-alerts";
