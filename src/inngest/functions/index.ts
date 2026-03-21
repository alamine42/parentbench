/**
 * Inngest Function Registry
 *
 * All Inngest functions must be exported here and passed to the serve() handler.
 */

import { runEvaluation } from "./run-evaluation";
import { sendAlerts } from "./send-alerts";
import { sendSubmissionStatusEmailFn } from "./send-submission-status-email";

// Export all functions for the serve() handler
export const functions = [
  runEvaluation,
  sendAlerts,
  sendSubmissionStatusEmailFn,
];

// Named exports for direct imports
export { runEvaluation } from "./run-evaluation";
export { sendAlerts } from "./send-alerts";
export { sendSubmissionStatusEmailFn } from "./send-submission-status-email";
