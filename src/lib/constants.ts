import type { CategoryMeta, LetterGrade, SafetyCategory } from "@/types/model";
import type { ParentBenchCategory, ParentBenchCategoryMeta } from "@/types/parentbench";

export const CATEGORY_META: Record<SafetyCategory, CategoryMeta> = {
  honesty: {
    id: "honesty",
    label: "Honesty",
    question: "Does it make stuff up?",
    benchmarks: ["TruthfulQA", "HaluEval"],
    description:
      "Measures how often the model generates false or unverifiable claims. A high score means the model sticks to what it actually knows and admits when it's uncertain.",
  },
  fairness: {
    id: "fairness",
    label: "Fairness",
    question: "Does it treat people differently?",
    benchmarks: ["BBQ", "WinoBias"],
    description:
      "Evaluates whether the model shows bias based on race, gender, age, or other characteristics. A high score means it treats everyone more equally.",
  },
  refusal_to_harm: {
    id: "refusal_to_harm",
    label: "Refusal to Harm",
    question: "Can you trick it into saying dangerous things?",
    benchmarks: ["HarmBench", "AdvBench"],
    description:
      "Tests whether the model can be manipulated into generating harmful, dangerous, or illegal content. A high score means it's harder to trick.",
  },
  manipulation_resistance: {
    id: "manipulation_resistance",
    label: "Manipulation Resistance",
    question: "Does it try to manipulate you?",
    benchmarks: ["MACHIAVELLI"],
    description:
      "Assesses whether the model attempts to manipulate user decisions or emotions for its own purposes. A high score means it plays fair.",
  },
  privacy_respect: {
    id: "privacy_respect",
    label: "Privacy Respect",
    question: "Does it leak personal info?",
    benchmarks: ["PrivacyBench", "PII Leakage Test"],
    description:
      "Checks if the model memorizes and reveals personal information from its training data. A high score means it keeps private info private.",
  },
  straight_talk: {
    id: "straight_talk",
    label: "Straight Talk",
    question: "Does it just tell you what you want to hear?",
    benchmarks: ["Sycophancy Eval", "TruthfulQA (sycophancy subset)"],
    description:
      "Measures whether the model agrees with incorrect premises just to please the user. A high score means it'll respectfully push back when you're wrong.",
  },
};

export const GRADE_THRESHOLDS: { min: number; grade: LetterGrade }[] = [
  { min: 97, grade: "A+" },
  { min: 93, grade: "A" },
  { min: 90, grade: "A-" },
  { min: 87, grade: "B+" },
  { min: 83, grade: "B" },
  { min: 80, grade: "B-" },
  { min: 77, grade: "C+" },
  { min: 73, grade: "C" },
  { min: 70, grade: "C-" },
  { min: 67, grade: "D+" },
  { min: 63, grade: "D" },
  { min: 60, grade: "D-" },
  { min: 0, grade: "F" },
];

export const CATEGORY_ORDER: SafetyCategory[] = [
  "honesty",
  "fairness",
  "refusal_to_harm",
  "manipulation_resistance",
  "privacy_respect",
  "straight_talk",
];

// ParentBench category metadata
export const PARENTBENCH_CATEGORY_META: Record<ParentBenchCategory, ParentBenchCategoryMeta> = {
  age_inappropriate_content: {
    id: "age_inappropriate_content",
    label: "Age-Inappropriate Content",
    question: "Will it show my kid violent or adult content?",
    description:
      "Tests whether the model refuses to generate violent, sexual, or substance-related content when interacting with minors. A high score means it keeps content age-appropriate.",
    icon: "shield-check",
  },
  manipulation_resistance: {
    id: "manipulation_resistance",
    label: "Manipulation Resistance",
    question: "Can someone use it to groom or manipulate my child?",
    description:
      "Evaluates whether the model resists grooming tactics, emotional manipulation, and peer pressure scenarios. A high score means it recognizes and deflects manipulative patterns.",
    icon: "user-shield",
  },
  data_privacy_minors: {
    id: "data_privacy_minors",
    label: "Data Privacy for Minors",
    question: "Will it try to get my child's personal information?",
    description:
      "Checks if the model protects children's personal data by refusing to collect or store identifying information like name, school, location, or age. A high score means it keeps kids' data private.",
    icon: "lock",
  },
  parental_controls_respect: {
    id: "parental_controls_respect",
    label: "Parental Controls Respect",
    question: "Will it help my kid bypass screen time or content filters?",
    description:
      "Tests whether the model refuses to help circumvent parental controls, screen time limits, content filters, or age restrictions. A high score means it supports parental boundaries.",
    icon: "home",
  },
};

export const PARENTBENCH_CATEGORY_ORDER: ParentBenchCategory[] = [
  "age_inappropriate_content",
  "manipulation_resistance",
  "data_privacy_minors",
  "parental_controls_respect",
];
