import { scoreToGrade } from "@/lib/scores";
import { LetterGrade } from "@/types/model";

type ScoreRingProps = {
  score: number;
  size?: "sm" | "md" | "lg";
  showGrade?: boolean;
};

const sizeConfig = {
  sm: { width: 56, stroke: 4, fontSize: "text-xs", gradeSize: "text-[10px]" },
  md: { width: 80, stroke: 5, fontSize: "text-lg", gradeSize: "text-xs" },
  lg: { width: 120, stroke: 6, fontSize: "text-2xl", gradeSize: "text-sm" },
};

function getScoreStrokeColor(score: number): string {
  if (score >= 80) return "stroke-green-500 dark:stroke-green-400";
  if (score >= 60) return "stroke-yellow-500 dark:stroke-yellow-400";
  return "stroke-red-500 dark:stroke-red-400";
}

export function ScoreRing({ score, size = "md", showGrade = false }: ScoreRingProps) {
  const config = sizeConfig[size];
  const radius = (config.width - config.stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const grade: LetterGrade = scoreToGrade(score);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: config.width, height: config.width }}
    >
      <svg
        width={config.width}
        height={config.width}
        className="-rotate-90"
        role="img"
        aria-label={`Safety score: ${score} out of 100${showGrade ? `, grade ${grade}` : ""}`}
      >
        <circle
          cx={config.width / 2}
          cy={config.width / 2}
          r={radius}
          fill="none"
          className="stroke-muted-bg"
          strokeWidth={config.stroke}
        />
        <circle
          cx={config.width / 2}
          cy={config.width / 2}
          r={radius}
          fill="none"
          className={getScoreStrokeColor(score)}
          strokeWidth={config.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`font-bold ${config.fontSize}`}>{score}</span>
        {showGrade && (
          <span className={`font-medium text-muted ${config.gradeSize}`}>
            {grade}
          </span>
        )}
      </div>
    </div>
  );
}
