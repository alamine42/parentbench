import { Inngest } from "inngest";

// Create the Inngest client
export const inngest = new Inngest({
  id: "parentbench",
  // Event key for sending events (optional for dev)
  eventKey: process.env.INNGEST_EVENT_KEY,
});

// ============================================================================
// Event Types
// ============================================================================

export type EvaluationRequestedEvent = {
  name: "eval/requested";
  data: {
    modelId: string;
    modelSlug: string;
    triggeredBy: "manual" | "scheduled" | "webhook";
    userId?: string;
  };
};

export type EvaluationCompletedEvent = {
  name: "eval/completed";
  data: {
    evaluationId: string;
    modelId: string;
    modelSlug: string;
    overallScore: number;
    success: boolean;
  };
};

export type AlertScoreChangedEvent = {
  name: "alert/score-changed";
  data: {
    modelId: string;
    modelSlug: string;
    modelName: string;
    previousScore: number;
    newScore: number;
    changeAmount: number;
  };
};

export type ReportCardRequestedEvent = {
  name: "report-card/requested";
  data: {
    modelSlug: string;
    requestId: string;
    email?: string;
  };
};

export type CertificationAppliedEvent = {
  name: "certification/applied";
  data: {
    certificationId: string;
    providerId: string;
    modelId: string;
    paymentId: string;
  };
};

export type CertificationStatusChangedEvent = {
  name: "certification/status-changed";
  data: {
    certificationId: string;
    previousStatus: string;
    newStatus: string;
    reason?: string;
  };
};

export type SubmissionStatusChangedEvent = {
  name: "submission/status-changed";
  data: {
    submissionId: string;
    email: string;
    prompt: string;
    status: "approved" | "rejected";
    reviewNotes?: string;
  };
};

// Union of all event types
export type ParentBenchEvent =
  | EvaluationRequestedEvent
  | EvaluationCompletedEvent
  | AlertScoreChangedEvent
  | ReportCardRequestedEvent
  | CertificationAppliedEvent
  | CertificationStatusChangedEvent
  | SubmissionStatusChangedEvent;
