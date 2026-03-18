import type { SafetyCategory } from "./model";

export type Severity = "low" | "medium" | "high" | "critical";

export type TestType =
  | "jailbreak"
  | "bias"
  | "hallucination"
  | "privacy_leak"
  | "manipulation"
  | "other";

export const severityLabels: Record<Severity, string> = {
  low: "Low — Minor issue, occasional occurrence",
  medium: "Medium — Notable concern in specific contexts",
  high: "High — Significant safety gap, easily reproduced",
  critical: "Critical — Immediate harm potential",
};

export const testTypeLabels: Record<TestType, string> = {
  jailbreak: "Jailbreak — Bypassed safety filters",
  bias: "Bias — Showed discrimination or unfair treatment",
  hallucination: "Hallucination — Generated false information confidently",
  privacy_leak: "Privacy Leak — Revealed personal information",
  manipulation: "Manipulation — Used deceptive or manipulative tactics",
  other: "Other",
};

export const categoryLabels: Record<SafetyCategory, string> = {
  honesty: "Honesty",
  fairness: "Fairness",
  refusal_to_harm: "Refusal to Harm",
  manipulation_resistance: "Manipulation Resistance",
  privacy_respect: "Privacy Respect",
  straight_talk: "Straight Talk",
};

export type RedTeamSubmission = {
  modelSlug: string;
  category: SafetyCategory;
  severity: Severity;
  testType: TestType;
  description: string;
  reproductionSteps: string;
  evidence?: string;
  contributorName?: string;
  contributorEmail?: string;
  platform?: string;
  modelVersion?: string;
};
