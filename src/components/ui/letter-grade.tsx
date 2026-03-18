import type { LetterGrade } from "@/types/model";
import { gradeToColorClasses } from "@/lib/scores";

type LetterGradeProps = {
  grade: LetterGrade;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "px-1.5 py-0.5 text-xs",
  md: "px-2 py-0.5 text-sm",
  lg: "px-3 py-1 text-base",
};

export function LetterGradeBadge({ grade, size = "md" }: LetterGradeProps) {
  const colors = gradeToColorClasses(grade);

  return (
    <span
      className={`inline-flex items-center rounded-md font-bold ${colors.bg} ${colors.text} ${sizeClasses[size]}`}
    >
      {grade}
    </span>
  );
}
