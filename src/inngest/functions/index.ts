/**
 * Inngest Function Registry
 *
 * All Inngest functions must be exported here and passed to the serve() handler.
 *
 * In `FROZEN=1` mode (2026-05-17), cron-triggered functions are dropped
 * from the registry so the next Inngest sync stops scheduling them.
 * Event-triggered functions are also dropped because all event sources
 * (admin endpoints, `eval/completed`, etc.) are themselves gated by the
 * freeze middleware and will never fire. The .ts files for each
 * function are unchanged — unfreeze restores by flipping the env var.
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
import { pairedApiRerun } from "./paired-api-rerun";

const FROZEN = process.env.FROZEN === "1";

// Export all functions for the serve() handler
export const functions = FROZEN
  ? []
  : [
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
      // Consumer-products track: pairs API runs with consumer publications
      // (parentbench-d95 §2b recency guardrail)
      pairedApiRerun,
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
export { pairedApiRerun } from "./paired-api-rerun";
