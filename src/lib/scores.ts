import type { LetterGrade } from "@/types/model";
import { GRADE_THRESHOLDS } from "./constants";

export function scoreToGrade(score: number): LetterGrade {
  for (const { min, grade } of GRADE_THRESHOLDS) {
    if (score >= min) return grade;
  }
  return "F";
}

export type ScoreColor = "green" | "yellow" | "red";

export function scoreToColor(score: number): ScoreColor {
  if (score >= 80) return "green";
  if (score >= 60) return "yellow";
  return "red";
}

export function scoreToColorClasses(score: number): {
  text: string;
  bg: string;
  bar: string;
} {
  const color = scoreToColor(score);
  const map = {
    green: {
      text: "text-green-700 dark:text-green-400",
      bg: "bg-green-100 dark:bg-green-900/30",
      bar: "bg-green-500 dark:bg-green-400",
    },
    yellow: {
      text: "text-yellow-700 dark:text-yellow-400",
      bg: "bg-yellow-100 dark:bg-yellow-900/30",
      bar: "bg-yellow-500 dark:bg-yellow-400",
    },
    red: {
      text: "text-red-700 dark:text-red-400",
      bg: "bg-red-100 dark:bg-red-900/30",
      bar: "bg-red-500 dark:bg-red-400",
    },
  };
  return map[color];
}

export function gradeToColorClasses(grade: LetterGrade): {
  text: string;
  bg: string;
} {
  if (grade.startsWith("A") || grade === "B+") {
    return {
      text: "text-green-700 dark:text-green-400",
      bg: "bg-green-100 dark:bg-green-900/30",
    };
  }
  if (grade.startsWith("B") || grade.startsWith("C")) {
    return {
      text: "text-yellow-700 dark:text-yellow-400",
      bg: "bg-yellow-100 dark:bg-yellow-900/30",
    };
  }
  return {
    text: "text-red-700 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-900/30",
  };
}
