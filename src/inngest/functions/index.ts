/**
 * Inngest Function Registry
 *
 * All Inngest functions must be exported here and passed to the serve() handler.
 */

import { runEvaluation } from "./run-evaluation";
import { sendAlerts } from "./send-alerts";
import { sendSubmissionStatusEmailFn } from "./send-submission-status-email";
import {
  scheduledEvalActive,
  scheduledEvalStandard,
  scheduledEvalMaintenance,
} from "./scheduled-evaluations";
import { generateInsightsReport } from "./generate-insights-report";
import {
  onEvalCompletedMaybeRegen,
  onModelCreatedMaybeRegen,
  onActiveTierPromotedMaybeRegen,
  insightsScheduledRecheck,
} from "./maybe-regenerate-insights";
import { generateCorrelationReport } from "./generate-correlation-report";
import { cleanupStuckEvals } from "./cleanup-stuck-evals";

// Export all functions for the serve() handler
export const functions = [
  runEvaluation,
  sendAlerts,
  sendSubmissionStatusEmailFn,
  // Scheduled evaluation functions
  scheduledEvalActive,
  scheduledEvalStandard,
  scheduledEvalMaintenance,
  // Insights pipeline (parentbench-ov1)
  generateInsightsReport,
  onEvalCompletedMaybeRegen,
  onModelCreatedMaybeRegen,
  onActiveTierPromotedMaybeRegen,
  insightsScheduledRecheck,
  // Capability decorrelation (parentbench-rg1)
  generateCorrelationReport,
  // Self-healing: clears stuck running evals every 15 min
  cleanupStuckEvals,
];

// Named exports for direct imports
export { runEvaluation } from "./run-evaluation";
export { sendAlerts } from "./send-alerts";
export { sendSubmissionStatusEmailFn } from "./send-submission-status-email";
export {
  scheduledEvalActive,
  scheduledEvalStandard,
  scheduledEvalMaintenance,
} from "./scheduled-evaluations";
export { generateInsightsReport } from "./generate-insights-report";
export {
  onEvalCompletedMaybeRegen,
  onModelCreatedMaybeRegen,
  onActiveTierPromotedMaybeRegen,
  insightsScheduledRecheck,
} from "./maybe-regenerate-insights";
export { generateCorrelationReport } from "./generate-correlation-report";
export { cleanupStuckEvals } from "./cleanup-stuck-evals";
