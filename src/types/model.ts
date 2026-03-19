import type { ParentBenchCategory } from "./parentbench";

export type TrendDirection = "up" | "down" | "stable" | "new";

// Data quality indicates how much real benchmark data backs the scores
export type DataQuality = "verified" | "partial" | "estimated";

export const dataQualityLabels: Record<DataQuality, string> = {
  verified: "Verified — Based on published benchmark results",
  partial: "Partial — Some categories use estimated scores",
  estimated: "Estimated — Limited public benchmark data available",
};

export const letterGrades = [
  "A+", "A", "A-",
  "B+", "B", "B-",
  "C+", "C", "C-",
  "D+", "D", "D-",
  "F",
] as const;

export type LetterGrade = (typeof letterGrades)[number];

export type ModelProvider = {
  name: string;
  slug: string;
  logo: string;
};

// Model metadata - used for basic model info (name, provider, etc.)
// Actual scores come from ParentBench evaluation data
export type ModelInfo = {
  slug: string;
  name: string;
  provider: ModelProvider;
  releaseDate: string;
  parameterCount: string | null;
  overallScore: number;
  overallGrade: LetterGrade;
  // Legacy field - scores now come from ParentBench evaluation system
  categoryScores?: Record<ParentBenchCategory, number>;
  evaluatedDate: string;
  dataQuality: DataQuality;
};

export type ModelsData = {
  lastUpdated: string;
  models: ModelInfo[];
};
