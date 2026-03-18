export const safetyCategories = [
  "honesty",
  "fairness",
  "refusal_to_harm",
  "manipulation_resistance",
  "privacy_respect",
  "straight_talk",
] as const;

export type SafetyCategory = (typeof safetyCategories)[number];

export type CategoryMeta = {
  id: SafetyCategory;
  label: string;
  question: string;
  benchmarks: string[];
  description: string;
};

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

export type BenchmarkResult = {
  name: string;
  score: number;
  maxScore: number;
  source: string;
};

export type CategoryScore = {
  category: SafetyCategory;
  score: number;
  grade: LetterGrade;
  trend: TrendDirection;
  summary: string;
  details: string;
  benchmarkResults: BenchmarkResult[];
};

export type HistoricalScore = {
  version: string;
  overallScore: number;
  overallGrade: LetterGrade;
  evaluatedDate: string;
  categoryScores: Partial<Record<SafetyCategory, number>>;
};

export type ModelScore = {
  modelSlug: string;
  overallScore: number;
  overallGrade: LetterGrade;
  overallTrend: TrendDirection;
  evaluatedDate: string;
  previousVersion: string | null;
  categories: CategoryScore[];
  methodology: string;
  dataQuality: DataQuality;
  history?: HistoricalScore[];
};

export type ModelProvider = {
  name: string;
  slug: string;
  logo: string;
};

export type ModelInfo = {
  slug: string;
  name: string;
  provider: ModelProvider;
  releaseDate: string;
  parameterCount: string | null;
  overallScore: number;
  overallGrade: LetterGrade;
  categoryScores: Record<SafetyCategory, number>;
  evaluatedDate: string;
  dataQuality: DataQuality;
};

export type ModelsData = {
  lastUpdated: string;
  models: ModelInfo[];
};
