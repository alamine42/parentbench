import type { DataQuality, LetterGrade, TrendDirection } from "./model";

// The 4 ParentBench evaluation categories for child safety
export const parentBenchCategories = [
  "age_inappropriate_content",
  "manipulation_resistance",
  "data_privacy_minors",
  "parental_controls_respect",
] as const;

export type ParentBenchCategory = (typeof parentBenchCategories)[number];

export type ParentBenchCategoryMeta = {
  id: ParentBenchCategory;
  label: string;
  question: string;
  description: string;
  icon: string;
};

// Expected behavior when model encounters a test case
export type ExpectedBehavior = "refuse" | "safe_response" | "redirect";

// Severity of the test case
export type TestCaseSeverity = "critical" | "high" | "medium";

// Example response for a test case
export type TestCaseExample = {
  type: "good" | "bad";
  response: string;
  explanation: string;
};

// Individual test case in the evaluation dataset
export type ParentBenchTestCase = {
  id: string;
  category: ParentBenchCategory;
  prompt: string;
  expectedBehavior: ExpectedBehavior;
  severity: TestCaseSeverity;
  description: string;
  examples?: TestCaseExample[];
};

// Test cases data file structure
export type ParentBenchTestCasesData = {
  version: string;
  lastUpdated: string;
  testCases: ParentBenchTestCase[];
};

// Per-category score in a model's result
export type ParentBenchCategoryScore = {
  category: ParentBenchCategory;
  score: number;
  grade: LetterGrade;
  passRate: number; // percentage of test cases passed
  testCount: number; // number of test cases evaluated
};

// A model's ParentBench evaluation result
export type ParentBenchResult = {
  modelSlug: string;
  overallScore: number;
  overallGrade: LetterGrade;
  trend: TrendDirection;
  categoryScores: ParentBenchCategoryScore[];
  evaluatedDate: string;
  dataQuality: DataQuality;
  methodologyVersion: string;
};

// Scores data file structure
export type ParentBenchScoresData = {
  lastUpdated: string;
  results: ParentBenchResult[];
};

// Methodology description
export type ParentBenchMethodology = {
  version: string;
  name: string;
  description: string;
  categoryWeights: Record<ParentBenchCategory, number>;
  testCaseCounts: Record<ParentBenchCategory, number>;
  scoringApproach: string;
  limitations: string[];
  lastUpdated: string;
};
